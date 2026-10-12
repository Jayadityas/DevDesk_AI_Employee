// Run an already prepared private fixture; clone ownership differs between
// sandbox and Docker-enabled execution. Preserve its earlier failed receipts.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),directory=path.resolve(process.argv[2]||''),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const injected=process.argv.includes('--inject-create-failure');
const auditOnly=process.argv.includes('--audit-existing');
if(!directory.startsWith(path.join(root,'var/evidence/phase5-rollback-')))throw new Error('Prepared private fixture required');
const job=await load(path.join(directory,'input.json')),isolated=path.join(directory,'synthetic-root');
if(path.resolve(job.root)!==isolated||job.op!=='integrate')throw new Error('Private integration fixture identity mismatch');
const source=path.join(isolated,'var/fixtures/frontend'),real=path.join(root,'var/fixtures/frontend'),release=(await load(path.join(root,'devdesk/build/latest.json'))).directory;
function git(where,args){const p=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c',`safe.directory=${where}`,'-c','core.hooksPath=NUL','-C',where,...args],{encoding:'utf8',windowsHide:true});if(p.status!==0)throw new Error('Private fixture Git read failed');return p.stdout.trim();}
const before=git(real,['rev-parse','HEAD']),original=git(source,['show',`${job.base_commit}:static/styles.css`]),checks=[];
const check=(name,good)=>checks.push({name,result:good?'PASS':'FAIL'});let receipt;
try{
 if(!auditOnly&&git(source,['rev-parse','HEAD'])!==job.base_commit)throw new Error('Prepared fixture already changed; no replay');
 const output=path.join(directory,injected?'docker-fault-output.json':'docker-enabled-output.json');let options=[];
 if(injected){
  const seam=path.join(directory,'explicit-docker-create-fault.mjs');
  await fs.writeFile(seam,'import cp from "node:child_process";import {syncBuiltinESMExports} from "node:module";const original=cp.execFileSync;cp.execFileSync=function(file,args,options){if(String(file).endsWith("/Docker/resources/bin/docker.exe")){if(args[0]==="info")return "28.1.1 linux";if(args[0]==="create")throw new Error("Explicit test-only Docker create failure");throw new Error("Unexpected Docker action in fault test");}return original(file,args,options);};syncBuiltinESMExports();');
  options=['--import',pathToFileURL(seam).href];
 }
 const p=auditOnly?{status:0}:spawnSync(process.execPath,[...options,path.join(release,'repair-helper.mjs'),path.join(directory,'input.json'),output],{encoding:'utf8',windowsHide:true,timeout:200000});
 const result=await load(output);if(p.status!==0||!result.ok)throw new Error(result.error||'Private rollback execution failed');receipt=result.result;
 if(injected)check('injected_post_merge_error_blocks_success',receipt.integrated===false&&receipt.checks===null&&receipt.error.includes('Explicit test-only Docker create failure'));
 else check('failed_integrated_checks_block_success',receipt.integrated===false&&receipt.checks.exit_code!==0&&receipt.checks.report.checks.some(c=>c.name==='no_horizontal_overflow_390'&&c.result==='FAIL'));
 check('prior_css_restored',(await fs.readFile(path.join(source,'static/styles.css'),'utf8')).replaceAll('\r\n','\n').trim()===original.replaceAll('\r\n','\n')&&git(source,['rev-parse','HEAD:static/styles.css'])===git(source,['rev-parse',`${job.base_commit}:static/styles.css`]));
 check('rollback_preserves_git_history',receipt.rollback_commit?.length===40&&git(source,['rev-parse','HEAD^'])===job.candidate_commit);
 check('rollback_checkout_clean',git(source,['status','--porcelain'])==='');
 check('real_shared_source_untouched',git(real,['rev-parse','HEAD'])===before&&git(real,['status','--porcelain'])==='');
}catch(error){checks.push({name:'prepared_rollback_suite',result:'FAIL',detail:error.message.slice(0,300)});}
const filename=auditOnly?'docker-fault-audit-report.json':injected?'docker-fault-report.json':'docker-enabled-report.json';
const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;await fs.writeFile(path.join(directory,filename),JSON.stringify({phase:5,mode:injected?'explicit_docker_create_fault_private_clone':'scripted_negative_private_clone',checks,receipt,real_container_checks_run:!injected},null,2));console.log(JSON.stringify({report:path.relative(root,path.join(directory,filename)),pass:checks.length-fail,fail}));
