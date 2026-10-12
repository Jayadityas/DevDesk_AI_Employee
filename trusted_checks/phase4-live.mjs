// Fresh-schema live Gemini flow. --patch-only never builds or executes candidate code.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawn,spawnSync} from 'node:child_process';
import net from 'node:net';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,exe=path.join(release,'devdesk.exe'),modelFile=path.join(root,'var/config/model.json');
const patchOnly=process.argv.includes('--patch-only');
if(!patchOnly&&!(await load(path.join(root,'var/config/runner.json')).catch(()=>({}))).verified)throw new Error('Containment unverified; no repair claim. Use explicit --patch-only for the disclosed no-execution fallback.');
const directory=path.join(root,'var/evidence',`phase4-live-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`);await fs.mkdir(directory,{recursive:true});
const checks=[],children=new Set(),base='http://127.0.0.1:8095';let user,evidence;
const check=(name,good)=>{checks.push({name,result:good?'PASS':'FAIL'});if(!good)throw new Error(name);};
function command(file,args){const r=spawnSync(file,args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(`Trusted command failed: ${path.basename(file)}; sensitive details withheld`);return r.stdout;}
async function api(endpoint,method='GET',data){const headers={Connection:'close'};if(user){headers.Cookie=user.cookie;if(method!=='GET')headers['X-CSRF-Token']=user.csrf;}if(data!==undefined)headers['Content-Type']='application/json';if(endpoint==='/api/requests')headers['Idempotency-Key']=crypto.randomUUID();const r=await fetch(base+endpoint,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw new Error(body.error||'Pilot API failed');return {body,headers:r.headers};}
async function worker(mode){const child=spawn(exe,[mode,path.join(directory,'test-config.json'),modelFile,root],{cwd:root,windowsHide:true,stdio:'ignore'});children.add(child);const timer=setInterval(()=>console.log(JSON.stringify({status:'Phase 4 live work in progress',mode,patch_only:patchOnly})),20000);const exit=await new Promise(r=>child.once('exit',r));clearInterval(timer);children.delete(child);return exit;}
try{
 const free=await new Promise(resolve=>{const probe=net.createServer();probe.once('error',()=>resolve(false));probe.listen({host:'127.0.0.1',port:8095,exclusive:true},()=>probe.close(()=>resolve(true)));});
 if(!free)throw new Error('Port 8095 occupied; existing service preserved');
 command(exe,['--model-access',modelFile]);
 const before=await(await fetch('http://127.0.0.1:8081/api/tasks')).text();
 command('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Setup-Phase2Test.ps1','-RunDirectory',directory]);command(exe,['--seed',path.join(directory,'test-config.json'),path.join(directory,'accounts.json')]);
 const server=spawn(exe,['--serve',path.join(directory,'test-config.json'),'8095',path.join(release,'static')],{cwd:root,windowsHide:true,stdio:'ignore'});children.add(server);
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const account=(await load(path.join(directory,'accounts.json'))).find(a=>a.username==='asha');const login=await api('/api/login','POST',{username:'asha',password:account.password});user={cookie:login.headers.get('set-cookie').split(';')[0]};user.csrf=(await api('/api/me')).body.csrf;
 const screenshot=await fs.readFile(path.join(root,'var/evidence/2026-10-10T15-55-30-050Z-45764/frontend-390x844.png'));
 const form=new FormData();form.append('screenshot',new Blob([screenshot],{type:'image/png'}),'synthetic-frontend-report.png');
 const uploaded=await fetch(base+'/api/uploads',{method:'POST',headers:{Cookie:user.cookie,'X-CSRF-Token':user.csrf},body:form});
 if(!uploaded.ok)throw new Error('Synthetic screenshot upload failed');const upload=(await uploaded.json()).id;
 const submit=await api('/api/requests','POST',{project_id:1,kind:'bug',title:'Task action buttons overlap on mobile',description:'At 390x844, task-card action buttons visually overlap. Please independently investigate and explain the observed behavior.',reproduction:'Open the task board, scroll to task cards, and inspect the Start/Complete and Remove buttons. Compare another viewport if useful.',page_url:'http://127.0.0.1:8081/',viewport_width:390,viewport_height:844,reported_impact:'cosmetic',upload_id:upload});const ticket=submit.body.ticket.id;
 const investigationExit=await worker('--worker');evidence=(await api(`/api/tickets/${ticket}`)).body;
 await fs.writeFile(path.join(directory,'redacted-trace.json'),JSON.stringify(evidence,null,2));
 check('real_read_only_investigation',investigationExit===0);
 await api(`/api/tickets/${ticket}/proposal`,'POST',{});const scope=(await api(`/api/tickets/${ticket}`)).body.proposals[0];
 check('reporter_approved_versioned_scope',(await api(`/api/proposals/${scope.id}/approve`,'POST',{scope_hash:scope.scope_hash})).body.state==='READY');
 const exit=await worker(patchOnly?'--patch-only':'--repair');evidence=(await api(`/api/tickets/${ticket}`)).body;
 await fs.writeFile(path.join(directory,'redacted-trace.json'),JSON.stringify(evidence,null,2));
 const run=evidence.repairs[0];
 check('real_model_patch_recorded',exit===0&&run.mode==='live'&&Number(run.model_calls)>0&&run.diff?.includes('static/styles.css'));
 if(patchOnly){check('explicit_unverified_patch_only',run.state==='PATCH_ONLY'&&evidence.ticket.state==='REPAIR_BLOCKED'&&!run.candidate_commit);check('no_candidate_execution',!evidence.repair_steps.some(s=>JSON.parse(s.action||'{}').tool==='run_checks'));}
 else{check('isolated_candidate_ready',run.state==='CANDIDATE_READY'&&run.candidate_commit.length===40);check('baseline_and_candidate_checks_recorded',evidence.repair_steps.filter(s=>JSON.parse(s.action||'{}').tool==='run_checks'&&s.state==='OBSERVED').length>=2);
  for(const width of [390,1280]){const artifact=await fetch(`${base}/api/repairs/${run.id}/artifacts/${width}.png`,{headers:{Cookie:user.cookie}});const bytes=Buffer.from(await artifact.arrayBuffer());check(`authorized_candidate_screenshot_${width}`,artifact.status===200&&artifact.headers.get('content-type')?.includes('image/png')&&bytes.length>100&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));}
  check('candidate_artifact_requires_login',(await fetch(`${base}/api/repairs/${run.id}/artifacts/390.png`)).status===401);
 }
 check('shared_source_preserved',command('git',['-c',`safe.directory=${path.join(root,'var/fixtures/frontend')}`,'-C',path.join(root,'var/fixtures/frontend'),'status','--porcelain']).trim()==='');
 check('existing_task_data_preserved',await(await fetch('http://127.0.0.1:8081/api/tasks')).text()===before);
 check('not_completed',evidence.ticket.state!=='COMPLETED');
}catch(error){checks.push({name:'live_phase4_run',result:'FAIL',detail:error.message});process.exitCode=1;}
finally{for(const child of children){if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}}
const report={phase:4,mode:'live',patch_only:patchOnly,execution_verified:!patchOnly&&checks.length>0&&checks.every(c=>c.result==='PASS'),build:await load(path.join(release,'build-info.json')),run:evidence?.repairs?.[0],checks};await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(root,'var/evidence/phase4-live-latest.json'),JSON.stringify({report:path.relative(root,path.join(directory,'report.json'))}));console.log(JSON.stringify({report:path.relative(root,path.join(directory,'report.json')),patch_only:patchOnly,pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length}));
