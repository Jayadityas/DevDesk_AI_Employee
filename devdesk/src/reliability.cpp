#include "reliability.hpp"
#include "repair.hpp"
#include "consensus.hpp"
#include <chrono>
#include <iostream>
namespace devdesk {
std::filesystem::path runtime_root(){wchar_t name[MAX_PATH];if(!GetModuleFileNameW(nullptr,name,MAX_PATH))throw Error(503,"Runtime location unavailable");auto root=std::filesystem::path(name).parent_path();for(int i=0;i<4;i++)root=root.parent_path();return root;}
std::filesystem::path runtime_release(){wchar_t name[MAX_PATH];if(!GetModuleFileNameW(nullptr,name,MAX_PATH))throw Error(503,"Release location unavailable");return std::filesystem::path(name).parent_path();}
void WorkerLease::write_capability(bool active){
 const auto directory=root/"var/leases";std::filesystem::create_directories(directory);
 const auto file=directory/"project-1.json",temporary=directory/(token+".tmp");
 const auto now=std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
 {std::ofstream stream(temporary);stream<<Json{{"token",token},{"fence",std::stoll(fence)},{"owner_schema",schema},{"kind",kind},{"expires_ms",active?now+120000:0}}.dump();if(!stream)throw Error(503,"Lease capability write failed");}
 if(!MoveFileExW(temporary.wstring().c_str(),file.wstring().c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))throw Error(503,"Lease capability activation failed");
}
WorkerLease::WorkerLease(Database &database,const Json &runtime,const std::filesystem::path &workspace,const std::string &worker_kind):db(database),config(runtime),root(workspace),token(random_hex(16)),kind(worker_kind),schema(runtime.at("schema")){
 if(std::filesystem::canonical(root)!=std::filesystem::canonical(runtime_root()))throw Error(403,"Worker workspace does not match protected release");
 if(db.query("SELECT pg_try_advisory_lock(440006,1) AS locked").get(0,"locked")!="t")throw Error(409,"Project worker busy");
 std::filesystem::create_directories(root/"var/locks");
 lock_handle=CreateFileW((root/"var/locks/project-1.lock").wstring().c_str(),GENERIC_READ|GENERIC_WRITE,0,nullptr,OPEN_ALWAYS,FILE_ATTRIBUTE_NORMAL,nullptr);
 if(lock_handle==INVALID_HANDLE_VALUE)throw Error(409,"Project worker busy: previous process still owns filesystem capacity");
 try{
  auto lease=db.query("INSERT INTO public.worker_leases(project_id,owner_token,owner_schema,fence,kind,state,heartbeat_at,expires_at) VALUES(1,$1,$2,1,$3,'ACTIVE',now(),now()+interval '120 seconds') ON CONFLICT(project_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,owner_schema=EXCLUDED.owner_schema,fence=worker_leases.fence+1,kind=EXCLUDED.kind,run_id='',state='ACTIVE',heartbeat_at=now(),expires_at=now()+interval '120 seconds' RETURNING fence",{token,schema,kind});
  fence=lease.get(0,"fence");db.query("SELECT set_config('devdesk.worker_token',$1,false),set_config('devdesk.worker_fence',$2,false)",{token,fence});write_capability(true);
  heartbeat=std::jthread([this](std::stop_token stop){
   try{Database heart(config);std::mutex mutex;std::unique_lock wait(mutex);
    while(!wake.wait_for(wait,stop,std::chrono::seconds(5),[]{return false;})){
     if(stop.stop_requested())break;
     auto alive=heart.query("UPDATE public.worker_leases SET heartbeat_at=now(),expires_at=now()+interval '120 seconds' WHERE project_id=1 AND owner_token=$1 AND fence=$2 AND state='ACTIVE' RETURNING fence",{token,fence});
     if(!alive.rows())throw Error(409,"Lease lost");
     write_capability(true);
    }
   }catch(...){healthy=false;try{write_capability(false);}catch(...){} }
  });
 }catch(...){CloseHandle(lock_handle);lock_handle=INVALID_HANDLE_VALUE;throw;}
}
WorkerLease::~WorkerLease(){
 heartbeat.request_stop();wake.notify_all();if(heartbeat.joinable())heartbeat.join();
 try{db.query("UPDATE public.worker_leases SET state='RELEASED',expires_at=now() WHERE project_id=1 AND owner_token=$1 AND fence=$2",{token,fence});write_capability(false);}catch(...){}
 if(lock_handle!=INVALID_HANDLE_VALUE)CloseHandle(lock_handle);
}
void WorkerLease::attach(const std::string &table,const std::string &run){
 if(table!="investigation_runs"&&table!="repair_runs"&&table!="integration_runs")throw Error(403,"Run table denied");
 db.query("UPDATE "+table+" SET lease_token=$2,lease_fence=$3 WHERE id=$1",{run,token,fence});db.query("UPDATE public.worker_leases SET run_id=$2 WHERE project_id=1 AND owner_token=$1",{token,run});
}
bool cancellation_requested(Database &db,const std::string &ticket){auto row=db.query("SELECT cancel_requested FROM tickets WHERE id=$1",{ticket});return row.rows()&&row.get(0,"cancel_requested")=="t";}
void WorkerLease::ensure(const std::string &ticket,bool allow_cancel){
 if(!healthy||!db.query("SELECT 1 FROM public.worker_leases WHERE project_id=1 AND owner_token=$1 AND fence=$2 AND state='ACTIVE' AND expires_at>now()",{token,fence}).rows())throw Error(409,"Worker fenced: no active lease");
 if(!allow_cancel&&!ticket.empty()&&cancellation_requested(db,ticket))throw Error(499,"Requester cancelled this operation");
}
void WorkerLease::bind_job(Json &job,const std::string &ticket)const{job["lease_token"]=token;job["lease_fence"]=std::stoll(fence);job["owner_schema"]=schema;job["ticket_id"]=ticket;}
void mark_cancellation(const Json &runtime,const std::string &ticket){const auto directory=runtime_root()/"var/control"/runtime.at("schema").get<std::string>();std::filesystem::create_directories(directory);std::ofstream file(directory/(ticket+".cancel.json"));file<<"{\"cancel_requested\":true}";if(!file)throw Error(503,"Cancellation marker could not be persisted");}
void record_notice(Database &db,const std::string &ticket,const std::string &key,const std::string &message){
 db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) SELECT r.employee_id,t.id,$2,$3 FROM tickets t JOIN requests r ON r.id=t.request_id WHERE t.id=$1 ON CONFLICT(operation_key) DO NOTHING",{ticket,key,message});
 db.query("INSERT INTO events(ticket_id,actor_kind,type,message) VALUES($1,'worker','recovery',$2)",{ticket,message});
}
void reconcile_work(Database &db,const std::filesystem::path &root){
 Transaction tx(db);
 reconcile_feature_polls(db);
 db.query("UPDATE preview_runs SET state='BLOCKED',summary='Interrupted preview activation; next activation inspects owned runtime before reuse.',finished_at=now() WHERE state='STARTED'");
 auto investigations=db.query("UPDATE investigation_runs SET state='INTERRUPTED',verdict='needs_information',summary='Interrupted; uncertain provider calls are not replayed.',usage_complete=CASE WHEN EXISTS(SELECT 1 FROM decisions d WHERE d.run_id=investigation_runs.id AND d.state='STARTED') THEN false ELSE usage_complete END,finished_at=now() WHERE state='RUNNING' RETURNING id,ticket_id");
 for(int i=0;i<investigations.rows();i++){const auto ticket=investigations.get(i,"ticket_id");const bool cancel=cancellation_requested(db,ticket);db.query("UPDATE tickets SET state=$2 WHERE id=$1",{ticket,cancel?"CANCELLED":"NEEDS_INFORMATION"});db.query("UPDATE investigations SET state=$2,confirmed=false WHERE id=(SELECT investigation_id FROM tickets WHERE id=$1)",{ticket,cancel?"cancelled":"needs_information"});record_notice(db,ticket,"recover-investigation:"+investigations.get(i,"id"),"Interrupted investigation retained; no automatic inference replay.");}
 auto repairs=db.query("UPDATE repair_runs SET state='INTERRUPTED',summary='Interrupted repair retained; no model or patch replay.',finished_at=now() WHERE state IN('RUNNING','VERIFYING') RETURNING id,ticket_id,lease_token");
 for(int i=0;i<repairs.rows();i++){const auto ticket=repairs.get(i,"ticket_id");db.query("UPDATE tickets SET state=$2 WHERE id=$1",{ticket,cancellation_requested(db,ticket)?"CANCELLED":"REPAIR_BLOCKED"});record_notice(db,ticket,"recover-repair:"+repairs.get(i,"id"),"Interrupted repair requires review; worktree, receipts and diffs are retained.");}
 auto scopes=db.query("UPDATE scope_proposals p SET state='STALE' FROM tickets t WHERE p.ticket_id=t.id AND p.state IN('PROPOSED','APPROVED') AND p.expires_at<=now() AND t.state IN('AWAITING_BUG_APPROVAL','AWAITING_FEATURE_VOTE','READY') RETURNING p.id,p.ticket_id");
 for(int i=0;i<scopes.rows();i++){const auto ticket=scopes.get(i,"ticket_id");db.query("UPDATE tickets SET state='INVESTIGATED_READ_ONLY' WHERE id=$1",{ticket});record_notice(db,ticket,"scope-expired:"+scopes.get(i,"id"),"Repair scope expired; renewed scope approval is required.");}
 auto reviews=db.query("UPDATE candidate_reviews cr SET state='STALE' FROM repair_runs rr,scope_proposals p,tickets t WHERE cr.repair_id=rr.id AND p.id=rr.proposal_id AND t.id=rr.ticket_id AND cr.state IN('PENDING','ACCEPTED') AND t.state IN('AWAITING_ACCEPTANCE','ACCEPTED') AND (cr.expires_at<=now() OR cr.candidate_commit<>rr.candidate_commit OR cr.scope_hash<>p.scope_hash OR rr.profile<>p.profile) RETURNING cr.id,rr.ticket_id");
 for(int i=0;i<reviews.rows();i++){const auto ticket=reviews.get(i,"ticket_id");db.query("UPDATE tickets SET state='CANDIDATE_READY' WHERE id=$1",{ticket});record_notice(db,ticket,"review-stale:"+reviews.get(i,"id"),"Candidate acceptance expired or changed; exact candidate must be reviewed again.");}
 tx.commit();
 // Remove only containers labelled with the interrupted run's former owner.
 // Failure leaves the evaluator's own bounded timeout in force.
 for(int i=0;i<repairs.rows();i++){
  const auto old=repairs.get(i,"lease_token");if(old.empty())continue;
  try{auto owner=db.query("SELECT owner_token,owner_schema,fence FROM public.worker_leases WHERE project_id=1 AND state='ACTIVE' AND expires_at>now()");
   if(!owner.rows())throw Error(409,"Recovery lease absent");
   Json cleanup={{"root",root.string()},{"run_id",repairs.get(i,"id")},{"op","cleanup_owned"},{"cleanup_owner",old},{"lease_token",owner.get(0,"owner_token")},{"owner_schema",owner.get(0,"owner_schema")},{"lease_fence",std::stoll(owner.get(0,"fence"))}};
   repair_helper(runtime_release(),root/"var/recovery-cleanup"/repairs.get(i,"id"),cleanup);
  }catch(...){}
 }
 // Git effects are never retried. A recorded verified journal can be reconciled
 // only after a fixed read-only helper checks current source and evidence.
 auto integrations=db.query("SELECT id,ticket_id,base_commit,candidate_commit,profile FROM integration_runs WHERE state='RUNNING'");
 for(int i=0;i<integrations.rows();i++){
  const auto id=integrations.get(i,"id"),ticket=integrations.get(i,"ticket_id");bool verified=false;Json receipt=Json::object();
  try{if(integrations.get(i,"profile")=="feature")require_feature_consensus(db,db.query("SELECT rr.proposal_id FROM integration_runs ir JOIN candidate_reviews cr ON cr.id=ir.review_id JOIN repair_runs rr ON rr.id=cr.repair_id WHERE ir.id=$1",{id}).get(0,"proposal_id"));const auto input=root/"var/integration-jobs"/id/"input.json";auto job=read_json(input);if(job.value("profile",std::string("frontend"))!=integrations.get(i,"profile")||job.at("run_id")!=id||job.at("base_commit")!=integrations.get(i,"base_commit")||job.at("candidate_commit")!=integrations.get(i,"candidate_commit"))throw Error(409,"Integration journal identity changed");job["op"]="reconcile_integration";receipt=repair_helper(runtime_release(),root/"var/recovery-jobs"/id,job);}catch(...){}
  // Conservative fallback until a verified journal has been positively checked.
  verified=receipt.value("verified",false);
  Transaction finish(db);db.query("UPDATE integration_runs SET state=$2,summary=$3,result=$4::jsonb,finished_at=now() WHERE id=$1 AND state='RUNNING'",{id,verified?"FINISHED":"BLOCKED",verified?"Recovered exact integrated verification; no Git replay.":"Interrupted integration requires review; no Git replay or blind rollback.",receipt.dump()});db.query("UPDATE tickets SET state=$2 WHERE id=$1",{ticket,verified?"COMPLETED":"INTEGRATION_BLOCKED"});record_notice(db,ticket,"recover-integration:"+id,verified?"Recovered completed integration from verified source and journal.":"Interrupted integration blocked pending review; source was preserved.");finish.commit();
 }
}
int recover_work(Database &db,const Json &runtime,const std::filesystem::path &root){WorkerLease lease(db,runtime,root,"recovery");reconcile_work(db,root);std::cout<<"Recovery reconciled; uncertain operations were not replayed.\n";return 0;}
int activate_preview(Database &db,const Json &runtime,const std::filesystem::path &root){
 WorkerLease lease(db,runtime,root,"preview");const auto id=random_hex(16);
 db.query("INSERT INTO preview_runs(id,state) VALUES($1,'STARTED')",{id});Json job={{"root",root.string()},{"run_id",id},{"op","activate_preview"}};lease.bind_job(job,"");
 try{Json results=Json::array();for(const std::string profile:{"frontend","backend","feature"}){job["profile"]=profile;auto result=repair_helper(runtime_release(),root/"var/preview-jobs"/id/profile,job);lease.ensure();results.push_back(result);if(!result.value("reused",false))std::cout<<"Isolated "<<profile<<" preview active at "<<result.at("origin").get<std::string>()<<'\n';}db.query("UPDATE preview_runs SET state='ACTIVE',result=$2::jsonb,summary='Isolated previews match current shared sources.',finished_at=now() WHERE id=$1",{id,results.dump()});return 0;}
 catch(const Error &error){db.query("UPDATE preview_runs SET state='BLOCKED',summary=$2,finished_at=now() WHERE id=$1",{id,error.what()});throw;}
}
}
