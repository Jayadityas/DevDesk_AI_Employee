// Continue the actual Phase 4 model-produced candidate. Negative API fixtures use
// fresh schemas; no new model calls, no changes to manual workbench records.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import net from 'node:net';import {spawn,spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,exe=path.join(release,'devdesk.exe');
const original=path.join(root,'var/evidence/phase4-live-2026-10-11T18-18-21.587Z-1932');
const sourceConfig=await load(path.join(original,'test-config.json')),originalTrace=await load(path.join(original,'redacted-trace.json'));
if(!/^test_[a-f0-9]{32}$/.test(sourceConfig.schema)||originalTrace.repairs[0].state!=='CANDIDATE_READY')throw new Error('Real verified Phase4 candidate required');
const directory=path.join(root,'var/evidence',`phase5-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`);await fs.mkdir(directory,{recursive:true});
const secrets=await load(path.join(root,'var/config/postgres-admin.json')),checks=[],children=new Set();let config,accounts,server,user,finalTrace;
const base='http://127.0.0.1:8100',repair=originalTrace.repairs[0].id,ticket=originalTrace.ticket.id;
const check=(name,good)=>{checks.push({name,result:good?'PASS':'FAIL'});if(!good)throw new Error(name);};
function cmd(file,args,options={}){const r=spawnSync(file,args,{encoding:'utf8',windowsHide:true,cwd:root,...options});if(r.status!==0)throw new Error(`Trusted ${path.basename(file)} failed; sensitive details withheld`);return r.stdout;}
function sql(text){return cmd('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5433','-U','devdesk_admin','-d','devdesk_demo'],{input:`SET search_path TO ${config.schema};\n${text}`,env:{...process.env,PGPASSWORD:secrets.admin}}).trim();}
async function api(endpoint,person=user,method='GET',data){const headers={Connection:'close'};if(person){headers.Cookie=person.cookie;if(method!=='GET')headers['X-CSRF-Token']=person.csrf;}if(data!==undefined)headers['Content-Type']='application/json';const r=await fetch(base+endpoint,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json(),headers:r.headers};}
async function login(username){const r=await api('/api/login',null,'POST',{username,password:accounts.find(a=>a.username===username).password});if(r.status!==200)throw new Error('Test login failed');const p={cookie:r.headers.get('set-cookie').split(';')[0]};p.csrf=(await api('/api/me',p)).body.csrf;return p;}
async function stop(){if(server?.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}children.delete(server);}
async function setup(name){await stop();const target=path.join(directory,name);await fs.mkdir(target,{recursive:true});cmd('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Setup-Phase2Test.ps1','-RunDirectory',target]);config=await load(path.join(target,'test-config.json'));cmd(exe,['--seed',path.join(target,'test-config.json'),path.join(target,'accounts.json')]);accounts=await load(path.join(target,'accounts.json'));
 let copy=`SET ROLE devdesk_owner; INSERT INTO requests SELECT (jsonb_populate_record(NULL::requests,to_jsonb(r) || '{"upload_id":null}'::jsonb)).* FROM ${sourceConfig.schema}.requests r;`;
 for(const table of ['investigations','tickets','investigation_runs','scope_proposals','scope_approvals','repair_runs','repair_steps'])copy+=`INSERT INTO ${table} SELECT * FROM ${sourceConfig.schema}.${table};`;
 sql(copy);
 const free=await new Promise(resolve=>{const p=net.createServer();p.once('error',()=>resolve(false));p.listen({host:'127.0.0.1',port:8100,exclusive:true},()=>p.close(()=>resolve(true)));});if(!free)throw new Error('Port 8100 occupied; existing service preserved');
 server=spawn(exe,['--serve',path.join(target,'test-config.json'),'8100',path.join(release,'static')],{windowsHide:true,stdio:'ignore'});children.add(server);
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}user=await login('asha');return target;
}
const fixture=path.join(root,'var/fixtures/frontend');const head=()=>cmd('git',['-c',`safe.directory=${fixture}`,'-C',fixture,'rev-parse','HEAD']).trim();
try{
 check('shared_base_matches_candidate',head()===originalTrace.repairs[0].base_commit);
 const rejected=await setup('rejected');const review=(await api(`/api/repairs/${repair}/review`,user,'POST',{})).body;
 check('rejection_recorded',(await api(`/api/candidate-reviews/${review.review_id}/decision`,user,'POST',{review_hash:review.review_hash,decision:'REJECTED'})).body.state==='CANDIDATE_REJECTED');
 check('rejected_candidate_not_integrated',cmd(exe,['--integrate',path.join(rejected,'test-config.json'),root]).includes('No eligible')&&head()===originalTrace.repairs[0].base_commit);
 check('rejection_cannot_flip_to_acceptance',(await api(`/api/candidate-reviews/${review.review_id}/decision`,user,'POST',{review_hash:review.review_hash,decision:'ACCEPTED'})).status===409);
 const target=await setup('accepted'),ravi=await login('ravi'),outsider=await login('outsider');
 check('other_member_review_denied',(await api(`/api/repairs/${repair}/review`,ravi,'POST',{})).status===403);
 const prepared=await api(`/api/repairs/${repair}/review`,user,'POST',{});check('exact_candidate_review_created',prepared.status===200);const r=prepared.body,url=`/api/candidate-reviews/${r.review_id}/decision`,body={review_hash:r.review_hash,decision:'ACCEPTED'};
 check('review_creation_idempotent',(await api(`/api/repairs/${repair}/review`,user,'POST',{})).body.review_id===r.review_id);
 check('member_cannot_accept',(await api(url,ravi,'POST',body)).status===403);check('nonmember_cannot_accept',(await api(url,outsider,'POST',body)).status===403);
 check('wrong_review_hash_denied',(await api(url,user,'POST',{...body,review_hash:'0'.repeat(64)})).status===409);
 const expiry=sql(`SELECT expires_at FROM candidate_reviews WHERE id='${r.review_id}';`);sql(`UPDATE candidate_reviews SET expires_at=now()-interval '1 second' WHERE id='${r.review_id}';`);check('expired_review_denied',(await api(url,user,'POST',body)).status===409);sql(`UPDATE candidate_reviews SET expires_at='${expiry}' WHERE id='${r.review_id}';`);
 sql(`UPDATE repair_runs SET candidate_commit='${'0'.repeat(40)}' WHERE id='${repair}';`);check('changed_candidate_denied',(await api(url,user,'POST',body)).status===409);sql(`UPDATE repair_runs SET candidate_commit='${originalTrace.repairs[0].candidate_commit}' WHERE id='${repair}';`);
 const saved=sql(`SELECT result FROM repair_steps WHERE run_id='${repair}' AND step=5;`);sql(`UPDATE repair_steps SET result=jsonb_set(result,'{report,checks,0,result}','"UNKNOWN"') WHERE run_id='${repair}' AND step=5;`);check('unknown_evidence_denied',(await api(url,user,'POST',body)).status===409);sql(`UPDATE repair_steps SET result='${saved.replaceAll("'","''")}'::jsonb WHERE run_id='${repair}' AND step=5;`);
 check('requester_acceptance_recorded',(await api(url,user,'POST',body)).body.state==='ACCEPTED');check('duplicate_acceptance_idempotent',(await api(url,user,'POST',body)).body.state==='ACCEPTED');check('one_immutable_decision',sql('SELECT count(*) FROM candidate_decisions;')==='1');
 const child=spawn(exe,['--integrate',path.join(target,'test-config.json'),root],{windowsHide:true,stdio:'ignore'});children.add(child);const timer=setInterval(()=>console.log(JSON.stringify({status:'Post-integration container verification running'})),20000);const exit=await new Promise(resolve=>child.once('exit',resolve));clearInterval(timer);children.delete(child);
 finalTrace=(await api(`/api/tickets/${ticket}`)).body;await fs.writeFile(path.join(directory,'redacted-trace.json'),JSON.stringify(finalTrace,null,2));
 check('accepted_candidate_integrated_and_verified',exit===0&&finalTrace.ticket.state==='COMPLETED'&&head()===originalTrace.repairs[0].candidate_commit);
 const result=JSON.parse(finalTrace.integrations[0].result);check('all_post_integration_assertions_pass',result.checks.report.checks.length===20&&result.checks.report.checks.every(c=>c.result==='PASS'));
 check('completion_in_history',(await api('/api/tickets?view=history')).body.tickets.some(t=>t.id===ticket&&t.state==='COMPLETED'));check('completion_absent_from_queue',!(await api('/api/tickets?view=queue')).body.tickets.some(t=>t.id===ticket));
 check('completion_notification_persisted',(await api('/api/notifications')).body.notifications.some(n=>n.message.includes('all mandatory post-integration')));
 check('duplicate_worker_no_reintegration',cmd(exe,['--integrate',path.join(target,'test-config.json'),root]).includes('No eligible')&&sql('SELECT count(*) FROM integration_runs;')==='1');
 check('duplicate_acceptance_returns_completed',(await api(url,user,'POST',body)).body.state==='COMPLETED');
}catch(error){checks.push({name:'phase5_suite',result:'FAIL',detail:error.message});process.exitCode=1;}
finally{for(const child of children){if(child?.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}}
await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:5,mode:'actual_phase4_candidate_continuation_with_fresh_negative_test_schemas',new_model_calls:0,build:await load(path.join(release,'build-info.json')),checks,integration:finalTrace?.integrations?.[0]},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length}));
