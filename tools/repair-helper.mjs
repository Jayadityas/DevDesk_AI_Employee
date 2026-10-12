// Fixed control-plane helper. Commands/origins/output paths never come from model text.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {checkControl} from './control-contract.mjs';
import {activatePreview} from './preview-helper.mjs';
import {repairProfile,commonChecks,assertProfileScope} from './repair-profile.mjs';
const job=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const root=path.resolve(job.root),run=job.run_id,profile=repairProfile(job.profile);
const sharedSource=path.join(root,'var/fixtures',profile.name),expectedHash=job.expected_file_hash||job.expected_css_hash;
if(!/^[a-f0-9]{32}$/.test(run))throw new Error('Invalid repair identity');
let workspace=path.join(root,'var/workspaces',run);
const gitExe='C:/Program Files/Git/cmd/git.exe', dockerExe='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function git(where,args){return execFileSync(gitExe,['-c',`safe.directory=${where}`,'-c','core.fsmonitor=false','-c','core.hooksPath=NUL','-c','commit.gpgsign=false','-C',where,...args],{encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:100000}).trim();}
function docker(args){try{return execFileSync(dockerExe,args,{encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:150000});}catch(error){throw new Error(`Docker ${args[0]} failed: ${String(error.stderr||error.message).trim().slice(0,220)}`);}}
async function editFile(){
 const file=path.join(workspace,profile.file);
 for(const segment of profile.file.split('/')){const candidate=segment===profile.file.split('/')[0]?path.join(workspace,segment):file;if((await fs.lstat(candidate)).isSymbolicLink())throw new Error('Source link denied');}
 const real=await fs.realpath(file);if(!real.toLowerCase().startsWith((workspace+path.sep).toLowerCase()))throw new Error('Source containment denied');
 if((await fs.stat(real)).size>64000)throw new Error('Source size limit');return real;
}
async function invariant(){
 await checkControl(job);
 const source=sharedSource;
 if(git(source,['rev-parse','HEAD'])!==job.base_commit||git(source,['status','--porcelain']))throw new Error('Approved shared baseline changed');
 const canonical=await fs.realpath(workspace);
 if(canonical.toLowerCase()!==workspace.toLowerCase())throw new Error('Workspace link denied');
 if(git(workspace,['rev-parse','HEAD'])!==job.base_commit)throw new Error('Workspace base changed');
 const changed=git(workspace,['diff','--name-only','HEAD']).split('\n').filter(Boolean);
 if(changed.some(p=>p!==profile.file)||git(workspace,['ls-files','--others','--exclude-standard']))throw new Error('Changes outside approved file scope');
 assertProfileScope(profile.name,git(workspace,['show',`${job.base_commit}:${profile.file}`]),(await fs.readFile(await editFile(),'utf8')).trim());
 git(workspace,['diff','--check']);
}
async function runContainer(mode){
 const css_before=hash(await fs.readFile(await editFile()));
 const config=JSON.parse((await fs.readFile(path.join(root,'var/config/runner.json'),'utf8')).replace(/^\uFEFF/,''));
 if(!/^sha256:[a-f0-9]{64}$/.test(config.image))throw new Error('Runner image identity unavailable');
 const name=`devdesk-repair-${run}-${job.step}`;
 if(!/^[a-z0-9-]+$/.test(name))throw new Error('Invalid container identity');
 const destination=path.join(root,'var/repair-evidence',run,String(job.step));await fs.mkdir(destination,{recursive:true});
 if(!/^[a-f0-9]{40}$/.test(job.base_commit))throw new Error('Invalid approved commit');
 const args=['create','--name',name,'--label','devdesk.phase=4','--network','none','--read-only','--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1536m','--memory-swap','1536m','--cpus','2','--pids-limit','128','--env',`DEVDESK_BASE_COMMIT=${job.base_commit}`,'--env',`DEVDESK_CSS_SHA256=${css_before}`,'--tmpfs','/tmp:rw,exec,nosuid,nodev,size=768m,mode=1777','--mount',`type=bind,source=${workspace},target=/input,readonly`];
 if(job.lease_token)args.push('--label',`devdesk.owner=${job.lease_token}`);
 const evaluatorUser=profile.name==='backend'?'10002:10002':'10001:10001';args[args.indexOf('--user')+1]=evaluatorUser;
 args.push('--env',`DEVDESK_PROFILE=${profile.name}`,'--env',`DEVDESK_FILE_SHA256=${css_before}`);
 args[args.findIndex(value=>value.startsWith('DEVDESK_CSS_SHA256='))]=`DEVDESK_CSS_SHA256=${hash(await fs.readFile(path.join(workspace,'static/styles.css')))}`;
 if(mode==='timeout_canary')args.push('--entrypoint','timeout');args.push(config.image);
 if(mode==='canary')args.push('canary');
 if(mode==='timeout_canary')args.push('--signal=KILL','2s','node','/opt/runner/check.mjs','timeout_canary');
 let created=false;
 try{
  docker(args);created=true;docker(['start',name]);
  const inspection=JSON.parse(docker(['inspect',name]))[0];
  const h=inspection.HostConfig;
  if(!h.ReadonlyRootfs||h.NetworkMode!=='none'||inspection.Config.User!==evaluatorUser||h.Privileged||h.PidsLimit!==128||h.Memory!==1536*1024*1024||h.MemorySwap!==h.Memory||h.NanoCpus!==2000000000||inspection.Mounts.some(m=>m.Type==='bind'&&(m.Destination!=='/input'||m.RW)))throw new Error('Container policy differs from trusted configuration');
  if(mode==='timeout_canary'){
   const output=docker(['wait',name]);return {timeout_stopped:JSON.parse(docker(['inspect',name]))[0].State.Running===false,exit_code:Number(output.trim())};
  }
  const begun=Date.now();let ready=false,appStarted=false;
  while(Date.now()-begun<140000){
   await checkControl(job);
   if(profile.name==='backend'&&mode==='checks'&&!appStarted){try{docker(['exec',name,'test','-f','/tmp/build-ready.json']);docker(['exec','--user','10001:10001','--detach',name,'node','/opt/runner/backend-app.mjs']);appStarted=true;}catch{}}
   try{docker(['exec',name,'test','-f','/tmp/evidence/report.json']);ready=true;break;}catch{}
   if(!JSON.parse(docker(['inspect',name]))[0].State.Running)throw new Error('Runner stopped without check evidence');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready)throw new Error('Container wall-time limit exceeded');
  // Export only bounded evaluator filenames, never arbitrary candidate directories.
  // Docker archive-copy does not expose this engine's live tmpfs. Read only fixed,
  // size-bounded evaluator artifacts through exec; retain the same container policy.
  async function exportArtifact(filename){
   if(!['report.json','390.png','1280.png'].includes(filename))throw new Error('Artifact name denied');
   const program='const fs=require("node:fs");const p=process.argv[1];if(fs.statSync(p).size>5242880)process.exit(2);process.stdout.write(fs.readFileSync(p));';
   const bytes=execFileSync(dockerExe,['exec',name,'node','-e',program,`/tmp/evidence/${filename}`],{timeout:15000,windowsHide:true,maxBuffer:5242880});
   await fs.writeFile(path.join(destination,filename),bytes);
  }
  await exportArtifact('report.json');
  const report=JSON.parse(await fs.readFile(path.join(destination,'report.json'),'utf8'));
  if(!Array.isArray(report.checks)||report.checks.length>40)throw new Error('Invalid check report');
  if(profile.name==='backend'&&mode==='canary'){
   const probe='const fs=require("node:fs");const denied=f=>{try{f();return false}catch{return true}};console.log(JSON.stringify({application_cannot_write_evaluator_report:denied(()=>fs.writeFileSync("/tmp/evidence/report.json","tampered")),application_cannot_read_evaluator_report:denied(()=>fs.readFileSync("/tmp/evidence/report.json")),application_cannot_signal_evaluator:denied(()=>process.kill(1,0)),application_cannot_change_uid:denied(()=>process.setuid(10002))}));';
   const separation=JSON.parse(docker(['exec','--user','10001:10001',name,'node','-e',probe]));
   for(const [name,pass] of Object.entries(separation))report.checks.push({name,result:pass===true?'PASS':'FAIL'});
   await fs.writeFile(path.join(destination,'report.json'),JSON.stringify(report));
  }
  if(mode==='checks')for(const width of [390,1280]){try{await exportArtifact(`${width}.png`);}catch{if(report.checks.length&&report.checks.every(c=>c.result==='PASS'))throw new Error('Passing check report requires both screenshots');}}
  if(hash(await fs.readFile(await editFile()))!==css_before)throw new Error('Candidate changed while checks ran');
  const exit_code=report.checks.length&&report.checks.every(c=>c.result==='PASS')?0:1;
  let rollback=null;
  const checkpointRoot=path.join(root,'var/repair-checkpoints',run);
  const checkpoint=JSON.parse(await fs.readFile(path.join(checkpointRoot,'latest.json'),'utf8').catch(()=>'null'));
  if(exit_code!==0&&checkpoint?.after_sha256===css_before){
   const attempted_diff=git(workspace,['diff','--',profile.file]);
   const previous=await fs.readFile(path.join(checkpointRoot,`${checkpoint.step}.${profile.name==="backend"?"cpp":"css"}`));
   if(hash(previous)!==checkpoint.before_sha256)throw new Error('Repair checkpoint identity changed');
   await fs.writeFile(await editFile(),previous);await invariant();
   rollback={restored_file_sha256:checkpoint.before_sha256,restored_css_sha256:checkpoint.before_sha256,attempted_diff,checkpoint_step:checkpoint.step};
  }
  return {report,exit_code,file_sha256:css_before,edit_path:profile.file,profile:profile.name,css_sha256:hash(await fs.readFile(path.join(workspace,'static/styles.css'))),rollback,image:config.image,container_policy:{network:'none',user:evaluatorUser,application_user:profile.name==='backend'?'10001:10001':evaluatorUser,read_only:true,pids:128,memory_mb:1536},artifact_directory:destination};
 }finally{if(created){try{docker(['rm','-f',name]);}catch{}}}
}
let result;
try{
 if(job.op==='activate_preview'){result=await activatePreview(job);}
 else if(job.op==='cleanup_owned'){
  await checkControl(job,{cancel:false});
  if(!/^[a-f0-9]{32}$/.test(job.cleanup_owner))throw new Error('Owned cleanup identity denied');
  const names=docker(['ps','-a','--filter',`label=devdesk.owner=${job.cleanup_owner}`,'--format','{{.Names}}']).trim().split('\n').filter(Boolean);
  const owned=names.filter(name=>new RegExp(`^devdesk-repair-${run}-[0-9]{1,2}$`).test(name));for(const name of owned)docker(['rm','-f',name]);result={removed:owned};
 }else if(job.op==='head'){result={commit:git(sharedSource,['rev-parse','HEAD']),clean:git(sharedSource,['status','--porcelain'])===''};}
 else if(job.op==='inspect_candidate'){
  if(!/^[a-f0-9]{32}$/.test(job.repair_id))throw new Error('Candidate identity denied');
  const candidate=path.join(root,'var/workspaces',job.repair_id),source=sharedSource;
  if((await fs.realpath(candidate)).toLowerCase()!==candidate.toLowerCase())throw new Error('Candidate link denied');
  assertProfileScope(profile.name,git(candidate,['show',`${job.base_commit}:${profile.file}`]),(await fs.readFile(path.join(candidate,profile.file),'utf8')).trim());
  result={commit:git(candidate,['rev-parse','HEAD']),parent:git(candidate,['rev-parse','HEAD^']),clean:git(candidate,['status','--porcelain'])==='',files:git(candidate,['diff','--name-only',job.base_commit,'HEAD']),file_sha256:hash(await fs.readFile(path.join(candidate,profile.file))),css_sha256:hash(await fs.readFile(path.join(candidate,"static/styles.css"))),source_commit:git(source,['rev-parse','HEAD']),source_clean:git(source,['status','--porcelain'])===''};
 }else if(job.op==='reconcile_integration'){
  const source=sharedSource,journal=JSON.parse(await fs.readFile(path.join(root,'var/integration-jobs',run,'mutation.json'),'utf8'));
  const report=journal.checks?.report;
  const required=[...commonChecks,...profile.checks];
  const valid=journal.stage==='VERIFIED'&&journal.integrated===true&&journal.commit===job.candidate_commit&&journal.checks.exit_code===0&&report?.identity?.base_commit===job.candidate_commit&&(profile.name!=="frontend"?report.identity.file_sha256:report.identity.css_sha256)===expectedHash&&report.checks.length===required.length&&required.every(name=>report.checks.some(c=>c.name===name&&c.result==='PASS'));
  const verified=valid&&git(source,['rev-parse','HEAD'])===job.candidate_commit&&!git(source,['status','--porcelain'])&&hash(await fs.readFile(path.join(source,profile.file)))===expectedHash;
  result={verified,stage:journal.stage,journal:verified?journal:null};
 }else if(job.op==='integrate'){
  await checkControl(job);
  if(!/^[a-f0-9]{32}$/.test(job.repair_id)||!/^[a-f0-9]{40}$/.test(job.candidate_commit))throw new Error('Invalid accepted candidate');
  const source=sharedSource,candidate=path.join(root,'var/workspaces',job.repair_id),base=job.base_commit;
  const sharedHead=git(source,['rev-parse','HEAD']),alreadyApplied=sharedHead===job.candidate_commit;
  if((sharedHead!==base&&!alreadyApplied)||git(source,['status','--porcelain']))throw new Error('Shared base changed or has edits; renewed review required');
  if(git(candidate,['rev-parse','HEAD'])!==job.candidate_commit||git(candidate,['status','--porcelain'])||git(candidate,['rev-parse','HEAD^'])!==base||git(candidate,['diff','--name-only',base,'HEAD'])!==profile.file)throw new Error('Accepted candidate identity or CSS-only scope changed');
  if(hash(await fs.readFile(path.join(candidate,profile.file)))!==expectedHash)throw new Error('Accepted candidate differs from checked file');
  assertProfileScope(profile.name,git(candidate,['show',`${base}:${profile.file}`]),(await fs.readFile(path.join(candidate,profile.file),'utf8')).trim());
  const engine=docker(['info','--format','{{.ServerVersion}} {{.OSType}}']).trim();
  if(!/^[0-9.]+ linux$/.test(engine))throw new Error('Docker Linux engine preflight failed; shared source unchanged');
  const journal=path.join(root,'var/integration-jobs',run,'mutation.json');await fs.mkdir(path.dirname(journal),{recursive:true});
  await fs.writeFile(journal,JSON.stringify({stage:'PREPARED',base_commit:base,candidate_commit:job.candidate_commit}));
  await checkControl(job);
  if(!alreadyApplied)git(source,['merge','--ff-only','--no-edit',job.candidate_commit]);workspace=source;job.base_commit=job.candidate_commit;
  await fs.writeFile(journal,JSON.stringify({stage:'APPLIED',base_commit:base,candidate_commit:job.candidate_commit}));
  let checks,error;
  try{checks=await runContainer('checks');if(checks.exit_code!==0)throw new Error('Mandatory post-integration checks failed');if(git(source,['rev-parse','HEAD'])!==job.candidate_commit||git(source,['status','--porcelain'])||hash(await fs.readFile(await editFile()))!==expectedHash)throw new Error('Integrated source changed during verification');}
  catch(failure){error=failure.message;}
  if(error){
   let rollback_commit=null;
   // Preserve history and never overwrite intervening or dirty user work.
   if(!alreadyApplied&&git(source,['rev-parse','HEAD'])===job.candidate_commit&&!git(source,['status','--porcelain'])){
    await checkControl(job,{cancel:false});
    git(source,['restore','--source',base,'--',profile.file]);git(source,['add','--',profile.file]);
    git(source,['-c','user.name=DevDesk Demo','-c','user.email=devdesk@example.invalid','commit','-m','Rollback failed accepted scoped integration']);rollback_commit=git(source,['rev-parse','HEAD']);
   }
   result={integrated:false,error,checks:checks||null,rollback_commit};
  }else result={integrated:true,commit:job.candidate_commit,checks};
  await fs.writeFile(journal,JSON.stringify({stage:result.integrated?'VERIFIED':'BLOCKED',...result}));
 }else if(job.op==='create'){
  await checkControl(job);
  const source=sharedSource;
  if(git(source,['rev-parse','HEAD'])!==job.base_commit||git(source,['status','--porcelain']))throw new Error('Approved baseline is stale');
  if(job.app_build){const build=JSON.parse((await fs.readFile(path.join(source,'build/build-info.json'),'utf8')).replace(/^\uFEFF/,''));if(build.commit!==job.base_commit||build.build!==job.app_build)throw new Error('Approved app build changed');}
  await fs.mkdir(path.dirname(workspace),{recursive:true});git(source,['worktree','add','--detach',workspace,job.base_commit]);result={workspace,base_commit:job.base_commit};
 }else{
  await invariant();
  if(job.op==='source_read'){const text=await fs.readFile(await editFile(),'utf8');result={path:profile.file,text:text.replaceAll('\r\n','\n'),sha256:hash(text),line_endings:text.includes('\r\n')?'CRLF':'LF'};}
  else if(job.op==='replace_text'){
   const file=await editFile(),text=await fs.readFile(file,'utf8');let before=job.action.before,after=job.action.after;
   if(typeof before==='string'&&typeof after==='string'){
    const crlf=text.includes('\r\n'),mixed=crlf&&text.replaceAll('\r\n','').includes('\n');
    if(mixed&&(before.includes('\n')||after.includes('\n')))throw Error('Mixed line endings require a single-line patch');
    const matching=value=>{const canonical=value.replaceAll('\r\n','\n');return crlf?canonical.replaceAll('\n','\r\n'):canonical;};before=matching(before);after=matching(after);
   }
   if(typeof before!=='string'||!before||typeof after!=='string'||before.length>12000||after.length>12000||text.split(before).length!==2)throw new Error('Patch must match exactly once within size limits');
   const updated=text.replace(before,after);if(updated.length>64000)throw new Error('Patched source exceeds limit');
   assertProfileScope(profile.name,text.trim(),updated.trim());
   const checkpointRoot=path.join(root,'var/repair-checkpoints',run);await fs.mkdir(checkpointRoot,{recursive:true});
   if(!Number.isSafeInteger(job.step)||job.step<1||job.step>12)throw new Error('Invalid patch step');
   await fs.writeFile(path.join(checkpointRoot,`${job.step}.${profile.name==="backend"?"cpp":"css"}`),text,{flag:'wx'});
   const checkpoint={step:job.step,before_sha256:hash(text),after_sha256:hash(updated)};
   await fs.writeFile(path.join(checkpointRoot,'latest.json'),JSON.stringify(checkpoint));
   await checkControl(job);await fs.writeFile(file,updated);await invariant();result={path:profile.file,...checkpoint,checkpoint_saved:true};
  }else if(job.op==='diff')result={diff:git(workspace,['diff','--',profile.file]),workspace};
  else if(['run_checks','canary','timeout_canary'].includes(job.op))result=await runContainer(job.op==='run_checks'?'checks':job.op);
  else if(job.op==='commit'){
   if(hash(await fs.readFile(await editFile()))!==expectedHash)throw new Error('Candidate differs from latest checked file');
   const diff=git(workspace,['diff','--',profile.file]);if(!diff)throw new Error('No candidate change');
   await checkControl(job);git(workspace,['add','--',profile.file]);git(workspace,['-c','user.name=DevDesk Demo','-c','user.email=devdesk@example.invalid','commit','-m','Scoped task candidate; requester acceptance pending']);
   result={candidate_commit:git(workspace,['rev-parse','HEAD']),diff,workspace};
  }else throw new Error('Unsupported trusted repair operation');
 }
 await fs.writeFile(process.argv[3],JSON.stringify({ok:true,result}));
}catch(error){await fs.writeFile(process.argv[3],JSON.stringify({ok:false,error:error.message.slice(0,250)}));process.exitCode=1;}
