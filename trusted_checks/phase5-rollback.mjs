// Exercise post-merge failure and history-preserving rollback in a private clone.
// The real shared checkout and manual data are never mutated by this test.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const directory=path.join(root,'var/evidence',`phase5-rollback-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`),isolated=path.join(directory,'synthetic-root');await fs.mkdir(isolated,{recursive:true});
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,runner=await load(path.join(root,'var/config/runner.json'));
const id=crypto.randomBytes(16).toString('hex'),repair=crypto.randomBytes(16).toString('hex'),base='4c0e6bab2605378fbbb33f82b1fd37e7bb458ed0';
const source=path.join(isolated,'var/fixtures/frontend'),workspace=path.join(isolated,'var/workspaces',repair),realSource=path.join(root,'var/fixtures/frontend'),checks=[];
function git(where,args){const safe=path.join(root,'playground').replaceAll('\\','/');const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c',`safe.directory=${where.replaceAll('\\','/')}`,'-c',`safe.directory=${safe}`,'-c','core.hooksPath=NUL','-c','commit.gpgsign=false','-C',where,...args],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:safe,GIT_CONFIG_KEY_1:'safe.directory',GIT_CONFIG_VALUE_1:safe+'/.git'}});if(r.status!==0)throw new Error(`Trusted Git ${args[0]} failed: ${r.stderr.slice(0,300)}`);return r.stdout.trim();}
const realHead=git(realSource,['rev-parse','HEAD']);
const check=(name,good)=>checks.push({name,result:good?'PASS':'FAIL'});let receipt;
try{
 await fs.mkdir(path.dirname(source),{recursive:true});
 const safe=path.join(root,'playground').replaceAll('\\','/');
 const cloned=spawnSync('C:/Program Files/Git/cmd/git.exe',['clone','--no-hardlinks','--no-checkout',safe,source.replaceAll('\\','/')],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:safe,GIT_CONFIG_KEY_1:'safe.directory',GIT_CONFIG_VALUE_1:safe+'/.git'}});
 if(cloned.status!==0)throw new Error(`Private clone setup failed: ${cloned.stderr.slice(0,300)}`);
 git(source,['checkout','--detach',base]);
 await fs.mkdir(path.dirname(workspace),{recursive:true});git(source,['worktree','add','--detach',workspace,base]);
 const original=await fs.readFile(path.join(source,'static/styles.css'));const bad=Buffer.concat([original,Buffer.from('\nbody { min-width: 2400px; }\n')]);await fs.writeFile(path.join(workspace,'static/styles.css'),bad);
 git(workspace,['add','--','static/styles.css']);git(workspace,['-c','user.name=DevDesk Negative Test','-c','user.email=test@example.invalid','commit','-m','Deliberately failing isolated CSS fixture']);const candidate=git(workspace,['rev-parse','HEAD']);
 await fs.mkdir(path.join(isolated,'var/config'),{recursive:true});await fs.writeFile(path.join(isolated,'var/config/runner.json'),JSON.stringify(runner));
 const input=path.join(directory,'input.json'),output=path.join(directory,'output.json');await fs.writeFile(input,JSON.stringify({root:isolated,run_id:id,repair_id:repair,base_commit:base,candidate_commit:candidate,expected_css_hash:crypto.createHash('sha256').update(bad).digest('hex'),op:'integrate',step:1}));
 const p=spawnSync(process.execPath,[path.join(release,'repair-helper.mjs'),input,output],{windowsHide:true,encoding:'utf8',timeout:200000});const result=await load(output);if(p.status!==0||!result.ok)throw new Error(result.error||'Rollback helper failed');receipt=result.result;
 check('failed_integrated_checks_block_success',receipt.integrated===false&&receipt.checks.exit_code!==0&&receipt.checks.report.checks.some(c=>c.name==='no_horizontal_overflow_390'&&c.result==='FAIL'));
 check('prior_css_bytes_restored',(await fs.readFile(path.join(source,'static/styles.css'))).equals(original));
 check('rollback_preserves_git_history',receipt.rollback_commit?.length===40&&git(source,['rev-parse','HEAD^'])===candidate);
 check('rollback_checkout_clean',git(source,['status','--porcelain'])==='');
 check('real_shared_source_untouched',git(realSource,['rev-parse','HEAD'])===realHead&&git(realSource,['status','--porcelain'])==='');
}catch(error){checks.push({name:'rollback_suite',result:'FAIL',detail:error.message.slice(0,300)});}
const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:5,mode:'scripted_negative_private_clone',checks,receipt},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));
