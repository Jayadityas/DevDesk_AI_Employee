#include "integration.hpp"
#include "reliability.hpp"
#include "consensus.hpp"
#include <windows.h>
#include <iostream>
namespace devdesk {
namespace {
Json checked_candidate(Database &db,const std::string &repair,int &step) {
 auto row=db.query("SELECT step,result FROM repair_steps WHERE run_id=$1 AND state='OBSERVED' AND action->>'tool'='run_checks' ORDER BY step DESC LIMIT 1",{repair});
 if(!row.rows())throw Error(409,"Candidate check evidence missing");
 step=std::stoi(row.get(0,"step"));auto evidence=Json::parse(row.get(0,"result"));
 const auto &checks=evidence.at("report").at("checks");
 const auto profile=db.query("SELECT profile FROM repair_runs WHERE id=$1",{repair}).get(0,"profile");const auto required=mandatory_checks(profile);
 std::set<std::string> observed;
 for(const auto &c:checks){if(c.at("result")!="PASS")throw Error(409,"Candidate has failed or unknown checks");observed.insert(c.at("name").get<std::string>());}
 if(observed!=required||checks.size()!=required.size()||evidence.at("exit_code")!=0||!std::regex_match(evidence.value("file_sha256",evidence.value("css_sha256",std::string())),std::regex("[a-f0-9]{64}")))throw Error(409,"Candidate mandatory checks incomplete");
 return evidence;
}
std::filesystem::path integration_release(const std::filesystem::path &root){wchar_t exe[MAX_PATH];if(!GetModuleFileNameW(nullptr,exe,MAX_PATH))throw Error(503,"Release unavailable");const auto release=std::filesystem::path(exe).parent_path();if(std::filesystem::canonical(release.parent_path())!=std::filesystem::canonical(root/"devdesk/build/releases"))throw Error(403,"Protected release required");return release;}
void inspect_candidate(Database &db,const std::string &repair,const Json &evidence){
 require_feature_consensus(db,db.query("SELECT proposal_id FROM repair_runs WHERE id=$1",{repair}).get(0,"proposal_id"));
 auto row=db.query("SELECT base_commit,candidate_commit,profile FROM repair_runs WHERE id=$1",{repair});if(!row.rows())throw Error(404,"Candidate unavailable");
 const auto state=repair_helper(runtime_release(),runtime_root()/"var/read-jobs"/random_hex(16),{{"root",runtime_root().string()},{"run_id",random_hex(16)},{"repair_id",repair},{"base_commit",row.get(0,"base_commit")},{"op","inspect_candidate"},{"profile",row.get(0,"profile")}});
 if(state.at("commit")!=row.get(0,"candidate_commit")||state.at("parent")!=row.get(0,"base_commit")||!state.at("clean").get<bool>()||state.at("files")!=repair_profile(row.get(0,"profile")).file||state.value("file_sha256",state.value("css_sha256",std::string()))!=evidence.value("file_sha256",evidence.value("css_sha256",std::string()))||!state.at("source_clean").get<bool>()||(state.at("source_commit")!=row.get(0,"base_commit")&&state.at("source_commit")!=row.get(0,"candidate_commit")))throw Error(409,"Candidate bytes or shared base changed; previous checks cannot authorize integration");
}
}
Json prepare_review(Database &db,const std::string &employee,const std::string &repair){
 Transaction tx(db);
 auto row=db.query("SELECT rr.candidate_commit,rr.state,rr.scope_hash AS repair_scope,rr.profile AS repair_profile,p.profile,p.scope_hash,t.id,t.state AS ticket_state,r.employee_id FROM repair_runs rr JOIN scope_proposals p ON p.id=rr.proposal_id JOIN tickets t ON t.id=rr.ticket_id JOIN requests r ON r.id=t.request_id WHERE rr.id=$1 FOR UPDATE OF rr,t",{repair});
 if(!row.rows())throw Error(404,"Candidate not found");
 if(row.get(0,"employee_id")!=employee)throw Error(403,"Only the requester can review acceptance");
 if(row.get(0,"repair_scope")!=row.get(0,"scope_hash")||row.get(0,"repair_profile")!=row.get(0,"profile"))throw Error(409,"Repair scope changed; a new checked candidate is required");
 if(row.get(0,"state")!="CANDIDATE_READY"||(row.get(0,"ticket_state")!="CANDIDATE_READY"&&row.get(0,"ticket_state")!="AWAITING_ACCEPTANCE"))throw Error(409,"Ticket has no reviewable candidate");
 auto old=db.query("SELECT id,review_hash FROM candidate_reviews WHERE repair_id=$1 AND state='PENDING' AND expires_at>now() ORDER BY created_at DESC LIMIT 1",{repair});
 if(old.rows()){tx.commit();return {{"review_id",old.get(0,"id")},{"review_hash",old.get(0,"review_hash")}};}
 int step;const auto evidence=checked_candidate(db,repair,step);const auto id=random_hex(16),commit=row.get(0,"candidate_commit");
 inspect_candidate(db,repair,evidence);
 const auto expiry=db.query("SELECT (now()+interval '30 minutes')::text AS expiry").get(0,"expiry");
 const auto binding=hash(id+":"+employee+":"+repair+":"+commit+":"+row.get(0,"scope_hash")+":"+std::to_string(step)+":"+evidence.dump()+":"+expiry);
 db.query("UPDATE candidate_reviews SET state='STALE' WHERE repair_id=$1 AND state='PENDING'",{repair});
 db.query("INSERT INTO candidate_reviews(id,repair_id,employee_id,candidate_commit,scope_hash,evidence_step,evidence,review_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::timestamptz)",{id,repair,employee,commit,row.get(0,"scope_hash"),std::to_string(step),evidence.dump(),binding,expiry});
 db.query("UPDATE tickets SET state='AWAITING_ACCEPTANCE' WHERE id=$1",{row.get(0,"id")});
 db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) VALUES($1,$2,$3,'Review exact candidate diff and evidence; acceptance permits guarded integration.')",{employee,row.get(0,"id"),"review:"+id});
 tx.commit();return {{"review_id",id},{"review_hash",binding}};
}
Json decide_review(Database &db,const std::string &employee,const std::string &review,const Json &body){
 const auto choice=body.at("decision").get<std::string>();if(choice!="ACCEPTED"&&choice!="REJECTED")throw Error(400,"Choose ACCEPTED or REJECTED");
 Transaction tx(db);auto row=db.query("SELECT cr.*,rr.ticket_id,rr.candidate_commit AS current_commit,p.scope_hash AS current_scope,p.profile AS current_profile,rr.profile AS repair_profile,t.state AS ticket_state FROM candidate_reviews cr JOIN repair_runs rr ON rr.id=cr.repair_id JOIN scope_proposals p ON p.id=rr.proposal_id JOIN tickets t ON t.id=rr.ticket_id WHERE cr.id=$1 FOR UPDATE OF cr,t",{review});
 if(!row.rows())throw Error(404,"Candidate review not found");
 if(row.get(0,"employee_id")!=employee)throw Error(403,"Only the requester can accept or reject");
 if(row.get(0,"review_hash")!=body.at("review_hash").get<std::string>())throw Error(409,"Candidate review binding changed");
 auto previous=db.query("SELECT decision FROM candidate_decisions WHERE review_id=$1",{review});
 if(previous.rows()){if(previous.get(0,"decision")!=choice)throw Error(409,"Review already decided differently");tx.commit();return {{"state",row.get(0,"ticket_state")}};}
 if(row.get(0,"state")!="PENDING"||row.get(0,"ticket_state")!="AWAITING_ACCEPTANCE"||!db.query("SELECT 1 FROM candidate_reviews WHERE id=$1 AND expires_at>now()",{review}).rows())throw Error(409,"Review expired or no longer pending");
 int step;auto evidence=checked_candidate(db,row.get(0,"repair_id"),step);
 inspect_candidate(db,row.get(0,"repair_id"),evidence);
 if(row.get(0,"current_profile")!=row.get(0,"repair_profile")||row.get(0,"candidate_commit")!=row.get(0,"current_commit")||row.get(0,"scope_hash")!=row.get(0,"current_scope")||step!=std::stoi(row.get(0,"evidence_step"))||evidence!=Json::parse(row.get(0,"evidence")))throw Error(409,"Candidate or evidence changed; renewed review required");
 db.query("INSERT INTO candidate_decisions(review_id,employee_id,review_hash,decision) VALUES($1,$2,$3,$4)",{review,employee,row.get(0,"review_hash"),choice});
 db.query("UPDATE candidate_reviews SET state=$2 WHERE id=$1",{review,choice});const auto state=choice=="ACCEPTED"?"ACCEPTED":"CANDIDATE_REJECTED";
 db.query("UPDATE tickets SET state=$2 WHERE id=$1",{row.get(0,"ticket_id"),state});
 db.query("INSERT INTO events(ticket_id,actor_id,type,message) VALUES($1,$2,'candidate_decision',$3)",{row.get(0,"ticket_id"),employee,"Exact candidate "+choice+"; no completion claimed."});
 db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) VALUES($1,$2,$3,$4)",{employee,row.get(0,"ticket_id"),"decision:"+review,choice=="ACCEPTED"?"Candidate accepted; awaiting guarded integration.":"Candidate rejected; source unchanged and evidence retained."});
 tx.commit();return {{"state",state}};
}
int run_integration(Database &db,const Json &runtime,const std::filesystem::path &root){
 const auto release=integration_release(root);if(!read_json(root/"var/config/runner.json").value("verified",false))throw Error(503,"Verified runner required; queue unchanged");
 if(db.query("SELECT pg_try_advisory_lock(440005,1) AS locked").get(0,"locked")!="t")return 0;
 if(db.query("SELECT pg_try_advisory_lock(hashtext(current_schema()),1) AS locked").get(0,"locked")!="t")return 0;
 WorkerLease lease(db,runtime,root,"integration");reconcile_work(db,root);
 std::string id,ticket,review,employee;Json job;
 {Transaction tx(db);auto r=db.query("SELECT cr.id,cr.repair_id,cr.candidate_commit,cr.scope_hash,cr.evidence_step,cr.evidence,cr.employee_id,rr.ticket_id,rr.base_commit,rr.profile FROM candidate_reviews cr JOIN candidate_decisions d ON d.review_id=cr.id AND d.decision='ACCEPTED' AND d.review_hash=cr.review_hash JOIN repair_runs rr ON rr.id=cr.repair_id AND rr.candidate_commit=cr.candidate_commit AND rr.scope_hash=cr.scope_hash JOIN scope_proposals p ON p.id=rr.proposal_id AND p.scope_hash=cr.scope_hash AND p.profile=rr.profile JOIN tickets t ON t.id=rr.ticket_id JOIN employees e ON e.id=cr.employee_id WHERE cr.state='ACCEPTED' AND cr.expires_at>now() AND t.state='ACCEPTED' AND NOT t.cancel_requested AND e.active AND EXISTS(SELECT 1 FROM memberships m WHERE m.employee_id=e.id AND m.project_id=1) ORDER BY t.priority,t.created_at,t.id FOR UPDATE OF t,cr SKIP LOCKED LIMIT 1");
 if(!r.rows()){tx.commit();std::cout<<"No eligible accepted candidate\n";return 0;}
 require_feature_consensus(db,db.query("SELECT proposal_id FROM repair_runs WHERE id=$1",{r.get(0,"repair_id")}).get(0,"proposal_id"));
 review=r.get(0,"id");ticket=r.get(0,"ticket_id");employee=r.get(0,"employee_id");int step;auto evidence=checked_candidate(db,r.get(0,"repair_id"),step);
 if(step!=std::stoi(r.get(0,"evidence_step"))||evidence!=Json::parse(r.get(0,"evidence")))throw Error(409,"Accepted evidence changed; integration not claimed");
 id=random_hex(16);job={{"root",root.string()},{"run_id",id},{"repair_id",r.get(0,"repair_id")},{"base_commit",r.get(0,"base_commit")},{"candidate_commit",r.get(0,"candidate_commit")},{"expected_css_hash",evidence.value("file_sha256",evidence.value("css_sha256",std::string()))},{"op","integrate"},{"step",1},{"profile",r.get(0,"profile")},{"expected_file_hash",evidence.value("file_sha256",evidence.value("css_sha256",std::string()))}};
 db.query("INSERT INTO integration_runs(id,ticket_id,review_id,state,base_commit,candidate_commit,worker_build) VALUES($1,$2,$3,'RUNNING',$4,$5,$6)",{id,ticket,review,r.get(0,"base_commit"),r.get(0,"candidate_commit"),read_json(release/"build-info.json").at("build").get<std::string>()});db.query("UPDATE tickets SET state='INTEGRATING' WHERE id=$1",{ticket});tx.commit();}
 db.query("UPDATE integration_runs SET profile=$2 WHERE id=$1",{id,job.at("profile").get<std::string>()});lease.attach("integration_runs",id);lease.bind_job(job,ticket);lease.ensure(ticket);
 Json result;bool success=false;std::string summary;
 try{result=repair_helper(release,root/"var/integration-jobs"/id,job);success=result.value("integrated",false)&&result.at("checks").at("exit_code")==0;summary=success?"Accepted candidate integrated; all mandatory post-integration container checks passed.":"Integration blocked; inspect retained checks and guarded rollback evidence.";}catch(const Error &error){summary=std::string("Integration blocked: ")+error.what();}catch(...){summary="Integration blocked; inspect local operation evidence. No completion claimed.";}
 lease.ensure(ticket,true);
 {Transaction tx(db);db.query("UPDATE integration_runs SET state=$2,result=$3::jsonb,summary=$4,finished_at=now() WHERE id=$1",{id,success?"FINISHED":"BLOCKED",result.dump(),summary});db.query("UPDATE tickets SET state=$2 WHERE id=$1",{ticket,success?"COMPLETED":"INTEGRATION_BLOCKED"});db.query("INSERT INTO events(ticket_id,actor_kind,type,message) VALUES($1,'worker','integration_result',$2)",{ticket,summary});db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) VALUES($1,$2,$3,$4)",{employee,ticket,"integration:"+id,summary});tx.commit();}
 lease.ensure(ticket,true);
 std::cout<<summary<<'\n';return success?0:1;
}
}
