#include "consensus.hpp"
namespace devdesk {
namespace {
void poll_notice(Database &db,const std::string &ticket,const std::string &poll,const std::string &message){
 db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) SELECT r.employee_id,t.id,$2,$3 FROM tickets t JOIN requests r ON r.id=t.request_id WHERE t.id=$1 ON CONFLICT(operation_key) DO NOTHING",{ticket,"poll-result:"+poll,message});
 db.query("INSERT INTO events(ticket_id,actor_kind,type,message) VALUES($1,'worker','feature_consensus',$2)",{ticket,message});
}
void reconcile_poll(Database &db,const std::string &poll){
 // All callers lock the ticket before this poll, matching scope/cancellation lock order.
 auto p=db.query("SELECT fp.*,p.scope_hash AS current_hash,p.state AS scope_state,t.state AS ticket_state,t.cancel_requested,fp.deadline<=now() AS expired FROM feature_polls fp JOIN scope_proposals p ON p.id=fp.proposal_id JOIN tickets t ON t.id=fp.ticket_id WHERE fp.id=$1 FOR UPDATE OF fp",{poll});
 if(!p.rows())return;
 const auto state=p.get(0,"state"),ticket=p.get(0,"ticket_id");
 if(state!="OPEN"&&state!="PASSED")return;
 const bool stale=p.get(0,"scope_hash")!=p.get(0,"current_hash")||p.get(0,"scope_state")=="STALE"||p.get(0,"scope_state")=="REJECTED"||p.get(0,"cancel_requested")=="t";
 if(stale){db.query("UPDATE feature_polls SET state='STALE',closed_at=now() WHERE id=$1",{poll});if(p.get(0,"ticket_state")=="READY"||p.get(0,"ticket_state")=="AWAITING_FEATURE_VOTE")db.query("UPDATE tickets SET state='INVESTIGATED_READ_ONLY' WHERE id=$1",{ticket});poll_notice(db,ticket,poll,"Feature scope changed or was withdrawn; votes do not authorize a replacement scope.");return;}
 auto counts=db.query("SELECT count(*) FILTER(WHERE choice='YES') AS yes,count(*) AS total FROM feature_votes WHERE poll_id=$1",{poll});
 const int yes=std::stoi(counts.get(0,"yes")),total=std::stoi(counts.get(0,"total")),threshold=std::stoi(p.get(0,"threshold")),n=std::stoi(p.get(0,"roster_size"));
 if(yes>=threshold){
  if(state=="OPEN"){db.query("UPDATE feature_polls SET state='PASSED',closed_at=now() WHERE id=$1",{poll});poll_notice(db,ticket,poll,"Feature consensus passed for this exact scope. Reporter scope approval and candidate acceptance remain required.");}
  if(p.get(0,"scope_state")=="APPROVED"&&p.get(0,"ticket_state")=="AWAITING_FEATURE_VOTE")db.query("UPDATE tickets SET state='READY' WHERE id=$1",{ticket});
 }else if(state=="OPEN"&&(p.get(0,"expired")=="t"||yes+n-total<threshold)){
  db.query("UPDATE feature_polls SET state='REJECTED',closed_at=now() WHERE id=$1",{poll});
  db.query("UPDATE scope_proposals SET state='REJECTED' WHERE id=$1",{p.get(0,"proposal_id")});
  db.query("UPDATE tickets SET state='INVALID' WHERE id=$1",{ticket});
  poll_notice(db,ticket,poll,"Feature consensus did not reach the required threshold; report moved to INVALID history. Votes and evidence retained.");
 }
}
}
void open_feature_poll(Database &db,const std::string &proposal){
 auto p=db.query("SELECT ticket_id,scope_hash,expires_at::text FROM scope_proposals WHERE id=$1 AND profile='feature'",{proposal});
 if(!p.rows())throw Error(409,"Feature scope unavailable");
 auto members=db.query("SELECT e.id,e.name FROM employees e JOIN memberships m ON m.employee_id=e.id WHERE m.project_id=1 AND e.active ORDER BY e.id");
 const int n=members.rows();if(n<1||n>1000)throw Error(409,"Feature roster must contain 1 to 1000 active members");
 const auto id=random_hex(16),goal=hash(id+":"+p.get(0,"scope_hash")+":"+members.json().dump()+":"+p.get(0,"expires_at"));
 db.query("INSERT INTO feature_polls(id,proposal_id,ticket_id,scope_hash,goal_hash,roster_size,threshold,deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)",{id,proposal,p.get(0,"ticket_id"),p.get(0,"scope_hash"),goal,std::to_string(n),std::to_string((2*n+2)/3),p.get(0,"expires_at")});
 for(int i=0;i<n;i++){
  db.query("INSERT INTO feature_poll_members(poll_id,employee_id,name) VALUES($1,$2,$3)",{id,members.get(i,"id"),members.get(i,"name")});
  db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) VALUES($1,$2,$3,'Feature vote requested: review the exact scope and criteria in this report before voting.')",{members.get(i,"id"),p.get(0,"ticket_id"),"poll-open:"+id+":"+members.get(i,"id")});
 }
}
Json feature_poll_detail(Database &db,const std::string &ticket){
 Json output=Json::array();
 for(const auto &p:db.query("SELECT * FROM feature_polls WHERE ticket_id=$1 ORDER BY created_at",{ticket}).json()){
  auto value=p;const auto id=p.at("id").get<std::string>();
  value["members"]=db.query("SELECT employee_id,name FROM feature_poll_members WHERE poll_id=$1 ORDER BY employee_id",{id}).json();
  value["votes"]=db.query("SELECT employee_id,choice,created_at FROM feature_votes WHERE poll_id=$1 ORDER BY employee_id",{id}).json();output.push_back(value);
 }
 return output;
}
void reconcile_feature_polls(Database &db){
 for(const auto &p:db.query("SELECT id,ticket_id FROM feature_polls WHERE state IN('OPEN','PASSED') ORDER BY ticket_id,id").json()){
  db.query("SELECT id FROM tickets WHERE id=$1 FOR UPDATE",{p.at("ticket_id").get<std::string>()});reconcile_poll(db,p.at("id").get<std::string>());
 }
}
Json cast_feature_vote(Database &db,const std::string &employee,const std::string &poll,const Json &input){
 const auto choice=input.at("choice").get<std::string>(),goal=input.at("goal_hash").get<std::string>();
 if(choice!="YES"&&choice!="NO")throw Error(400,"Vote must be YES or NO");
 Transaction tx(db);auto ticket=db.query("SELECT ticket_id FROM feature_polls WHERE id=$1",{poll});if(!ticket.rows())throw Error(404,"Poll not found");
 db.query("SELECT id FROM tickets WHERE id=$1 FOR UPDATE",{ticket.get(0,"ticket_id")});
 auto p=db.query("SELECT * FROM feature_polls WHERE id=$1 FOR UPDATE",{poll});
 if(!db.query("SELECT 1 FROM feature_poll_members fm JOIN employees e ON e.id=fm.employee_id JOIN memberships m ON m.employee_id=e.id AND m.project_id=1 WHERE fm.poll_id=$1 AND fm.employee_id=$2 AND e.active",{poll,employee}).rows())throw Error(403,"Only active project members in this poll's snapshot may vote");
 if(p.get(0,"goal_hash")!=goal)throw Error(409,"Vote goal changed; refresh the exact proposal");
 reconcile_poll(db,poll);
 auto old=db.query("SELECT choice,goal_hash FROM feature_votes WHERE poll_id=$1 AND employee_id=$2",{poll,employee});
 if(old.rows()){if(old.get(0,"choice")!=choice||old.get(0,"goal_hash")!=goal)throw Error(409,"Your vote is immutable; a conflicting replay is denied");tx.commit();return {{"replayed",true}};}
 if(!db.query("SELECT 1 FROM feature_polls WHERE id=$1 AND state='OPEN' AND deadline>now()",{poll}).rows()){tx.commit();throw Error(409,"Poll closed or deadline passed; no vote recorded");}
 db.query("INSERT INTO feature_votes(poll_id,employee_id,choice,goal_hash) VALUES($1,$2,$3,$4)",{poll,employee,choice,goal});reconcile_poll(db,poll);tx.commit();return {{"replayed",false}};
}
void require_feature_consensus(Database &db,const std::string &proposal){
 auto profile=db.query("SELECT profile FROM scope_proposals WHERE id=$1",{proposal});if(!profile.rows())throw Error(409,"Scope missing");if(profile.get(0,"profile")!="feature")return;
 if(!db.query("SELECT 1 FROM feature_polls fp JOIN scope_proposals p ON p.id=fp.proposal_id JOIN requests r ON r.id=(SELECT request_id FROM tickets WHERE id=p.ticket_id) WHERE p.id=$1 AND r.kind='feature' AND fp.state='PASSED' AND fp.scope_hash=p.scope_hash AND fp.threshold=(2*fp.roster_size+2)/3 AND fp.roster_size=(SELECT count(*) FROM feature_poll_members WHERE poll_id=fp.id) AND (SELECT count(*) FROM feature_votes WHERE poll_id=fp.id AND choice='YES' AND goal_hash=fp.goal_hash)>=fp.threshold",{proposal}).rows())throw Error(409,"Exact feature consensus is absent or stale");
}
}
