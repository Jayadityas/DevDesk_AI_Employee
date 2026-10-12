// Deliberately failing CSS in an isolated synthetic checkout; never model context.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
if(!(await load(path.join(root,'var/config/runner.json'))).verified)throw new Error('Verified containment required');
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,base=await load(path.join(root,'var/fixtures/frontend/build/build-info.json'));
const run=crypto.randomBytes(16).toString('hex'),directory=path.join(root,'var/evidence',`phase4-rollback-${run}`);await fs.mkdir(directory,{recursive:true});let step=0;const checks=[];
async function tool(op,action){const input=path.join(directory,`${step}-${op}.json`),output=input+'.out';await fs.writeFile(input,JSON.stringify({root,run_id:run,step:step++,base_commit:base.commit,app_build:base.build,op,action}));const p=spawnSync(process.execPath,[path.join(release,'repair-helper.mjs'),input,output],{encoding:'utf8',windowsHide:true,timeout:200000});const r=await load(output);if(p.status!==0||!r.ok)throw new Error(r.error||'Tool failed');return r.result;}
function check(name,good){checks.push({name,result:good?'PASS':'FAIL'});}
try{await tool('create');const before=await tool('source_read');
 const patched=await tool('replace_text',{before:before.text,after:before.text+'\nbody { min-width: 2400px; }\n'});check('checkpoint_before_patch',patched.checkpoint_saved===true);
 const failed=await tool('run_checks');check('bad_css_fails_independent_checks',failed.exit_code!==0&&failed.report.checks.some(c=>c.name==='no_horizontal_overflow_390'&&c.result==='FAIL'));
 check('rollback_recorded_with_attempted_diff',failed.rollback?.attempted_diff?.includes('min-width: 2400px')&&failed.rollback.restored_css_sha256===before.sha256);
 const restored=await tool('source_read');check('original_css_restored',restored.sha256===before.sha256);check('failed_attempt_not_committed',(await tool('diff')).diff==='');
}catch(error){checks.push({name:'rollback_suite',result:'FAIL',detail:error.message});}
await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:4,mode:'scripted_negative_isolated_check',checks},null,2));const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));
