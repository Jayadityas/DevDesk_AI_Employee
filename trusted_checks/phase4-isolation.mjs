import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory;
const image=await load(path.join(root,'var/config/runner.json'));
const run=crypto.randomBytes(16).toString('hex'),directory=path.join(root,'var/evidence',`phase4-isolation-${run}`);await fs.mkdir(directory,{recursive:true});
const base=await load(path.join(root,'var/fixtures/frontend/build/build-info.json')),checks=[];let step=0;
async function tool(op){const job={root,run_id:run,step:step++,base_commit:base.commit,app_build:base.build,op};const input=path.join(directory,`${op}.json`),output=input+'.out';await fs.writeFile(input,JSON.stringify(job));const child=spawnSync(process.execPath,[path.join(release,'repair-helper.mjs'),input,output],{cwd:root,encoding:'utf8',windowsHide:true,timeout:200000});const receipt=await load(output);if(child.status!==0||!receipt.ok)throw new Error(receipt.error||'Isolation tool failed');return receipt.result;}
try{
 await tool('create');const canary=await tool('canary');checks.push(...canary.report.checks);
 const timeout=await tool('timeout_canary');checks.push({name:'timeout_process_stopped',result:timeout.timeout_stopped&&timeout.exit_code!==0?'PASS':'FAIL'});
 const baseline=await tool('run_checks');checks.push({name:'Linux baseline matches observable mobile failure',result:baseline.report.checks.some(c=>c.name==='action_buttons_separate_390'&&c.result==='FAIL')&&baseline.report.checks.every(c=>c.name==='action_buttons_separate_390'||c.result==='PASS')?'PASS':'FAIL'});
 if(checks.every(c=>c.result==='PASS')){image.verified=true;image.verified_at=new Date().toISOString();image.evidence=path.relative(root,directory);await fs.writeFile(path.join(root,'var/config/runner.json'),JSON.stringify(image,null,2));}else process.exitCode=1;
}catch(error){checks.push({name:'isolation_demonstration',result:'FAIL',detail:error.message});process.exitCode=1;}
await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:4,scope:'isolation prerequisite',image:image.image,checks},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length}));
