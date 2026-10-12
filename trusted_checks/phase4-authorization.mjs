// Real API/auth and real read-only baseline; no live model call or edited-code execution.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawn,spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,exe=path.join(release,'devdesk.exe');
const directory=path.join(root,'var/evidence',`phase4-auth-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`);await fs.mkdir(directory,{recursive:true});
const checks=[],base='http://127.0.0.1:8096',children=new Set();let config,secrets,accounts;
const check=(name,good)=>{checks.push({name,result:good?'PASS':'FAIL'});if(!good)throw new Error(name);};
function cmd(file,args,options={}){const r=spawnSync(file,args,{cwd:root,encoding:'utf8',windowsHide:true,...options});if(r.status!==0)throw new Error(`Trusted command failed: ${path.basename(file)}; details withheld`);return r.stdout;}
function sql(text){return cmd('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5433','-U','devdesk_admin','-d','devdesk_demo'],{input:`SET search_path TO ${config.schema};\n${text}`,env:{...process.env,PGPASSWORD:secrets.admin}}).trim();}
async function api(endpoint,user,method='GET',data){const headers={Connection:'close'};if(user){headers.Cookie=user.cookie;if(method!=='GET')headers['X-CSRF-Token']=user.csrf;}if(data!==undefined)headers['Content-Type']='application/json';if(endpoint==='/api/requests')headers['Idempotency-Key']=crypto.randomUUID();const r=await fetch(base+endpoint,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json(),headers:r.headers};}
async function login(username){const r=await api('/api/login',null,'POST',{username,password:accounts.find(a=>a.username===username).password});check(`login_${username}`,r.status===200);const user={cookie:r.headers.get('set-cookie').split(';')[0]};user.csrf=(await api('/api/me',user)).body.csrf;return user;}
const action=(tool,extra={})=>({tool,path:'',query:'',status:'',start_line:1,limit:80,verdict:'',summary:'SCRIPTED TEST baseline',evidence_ids:[],...extra});
try{
 secrets=await load(path.join(root,'var/config/postgres-admin.json'));
 cmd('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Setup-Phase2Test.ps1','-RunDirectory',directory]);config=await load(path.join(directory,'test-config.json'));
 cmd(exe,['--seed',path.join(directory,'test-config.json'),path.join(directory,'accounts.json')]);
 accounts=await load(path.join(directory,'accounts.json'));
 check('repair_C++_policy_checks',cmd(exe,['--repair-selftest']).includes('8 PASS'));
 const live=await fetch('http://127.0.0.1:8081/api/tasks');const before=await live.text();
 const child=spawn(exe,['--serve',path.join(directory,'test-config.json'),'8096',path.join(release,'static')],{cwd:root,windowsHide:true,stdio:'ignore'});children.add(child);
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const asha=await login('asha'),ravi=await login('ravi'),outsider=await login('outsider');
 const report={project_id:1,kind:'bug',title:'Mobile task buttons overlap',description:'Please independently observe overlapping action buttons.',reproduction:'Inspect task cards at 390x844.',page_url:'http://127.0.0.1:8081/',viewport_width:390,viewport_height:844,reported_impact:'cosmetic'};
 const submitted=await api('/api/requests',asha,'POST',report);check('submission',submitted.status===201);const id=submitted.body.ticket.id;
 check('uninvestigated_scope_denied',(await api(`/api/tickets/${id}/proposal`,asha,'POST',{})).status===409);
 const scripted=path.join(directory,'baseline-model.json');await fs.writeFile(scripted,JSON.stringify({provider:'scripted_test',vision:false,actions:[action('project_instructions'),action('source_read',{path:'static/styles.css'}),action('browser_observe'),action('finish',{verdict:'reproduced',evidence_ids:['$last']})]}));
 cmd(exe,['--test-worker',path.join(directory,'test-config.json'),scripted,root]);
 check('other_member_proposal_denied',(await api(`/api/tickets/${id}/proposal`,ravi,'POST',{})).status===403);
 const proposed=await api(`/api/tickets/${id}/proposal`,asha,'POST',{});check('scope_prepared',proposed.status===201);const proposal=proposed.body.proposal_id;
 const detail=(await api(`/api/tickets/${id}`,asha)).body;const scope=detail.proposals[0];
 check('versioned_scope_with_CSS_and_expiry',JSON.parse(scope.files).join(',')==='static/styles.css'&&scope.base_commit.length===40&&scope.scope_hash.length===64&&scope.expires_at);
 check('scope_creation_idempotent',(await api(`/api/tickets/${id}/proposal`,asha,'POST',{})).body.proposal_id===proposal);
 check('other_member_approval_denied',(await api(`/api/proposals/${proposal}/approve`,ravi,'POST',{scope_hash:scope.scope_hash})).status===403);
 check('outsider_approval_denied',(await api(`/api/proposals/${proposal}/approve`,outsider,'POST',{scope_hash:scope.scope_hash})).status===403);
 check('changed_scope_hash_denied',(await api(`/api/proposals/${proposal}/approve`,asha,'POST',{scope_hash:'0'.repeat(64)})).status===409);
 sql(`UPDATE scope_proposals SET expires_at=now()-interval '1 second' WHERE id='${proposal}';`);
 check('expired_scope_denied',(await api(`/api/proposals/${proposal}/approve`,asha,'POST',{scope_hash:scope.scope_hash})).status===409);
 sql(`UPDATE scope_proposals SET expires_at=now()+interval '30 minutes' WHERE id='${proposal}';`);
 check('reporter_approval_ready',(await api(`/api/proposals/${proposal}/approve`,asha,'POST',{scope_hash:scope.scope_hash})).body.state==='READY');
 check('duplicate_approval_idempotent',(await api(`/api/proposals/${proposal}/approve`,asha,'POST',{scope_hash:scope.scope_hash})).body.state==='READY');
 check('one_immutable_approval',sql(`SELECT count(*) FROM scope_approvals WHERE proposal_id='${proposal}';`)==='1');
 const denied=path.join(directory,'denied-repair.json');await fs.writeFile(denied,JSON.stringify({provider:'scripted_test',actions:[]}));
 const runner=await load(path.join(root,'var/config/runner.json')).catch(()=>null);
 if(!runner?.verified){const r=spawnSync(exe,['--test-repair',path.join(directory,'test-config.json'),denied,root],{cwd:root,encoding:'utf8',windowsHide:true});check('unverified_runner_no_claim',r.status!==0&&sql(`SELECT state FROM tickets WHERE id=${id};`)==='READY'&&sql('SELECT count(*) FROM repair_runs;')==='0');}
 check('existing_frontend_data_preserved',await(await fetch('http://127.0.0.1:8081/api/tasks')).text()===before);
 check('shared_fixture_clean',cmd('git',['-c',`safe.directory=${path.join(root,'var/fixtures/frontend')}`,'-C',path.join(root,'var/fixtures/frontend'),'status','--porcelain']).trim()==='');
 check('never_completed',sql("SELECT count(*) FROM tickets WHERE state='COMPLETED';")==='0');
}catch(error){checks.push({name:'authorization_suite',result:'FAIL',detail:error.message});process.exitCode=1;}
finally{for(const child of children){if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}}
const report={phase:4,scope:'authorization and no-execution gate',build:await load(path.join(release,'build-info.json')),checks,live_model_calls:0};await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({report:path.relative(root,path.join(directory,'report.json')),pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length}));
