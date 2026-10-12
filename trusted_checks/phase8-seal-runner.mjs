// Bind all three saved, real runtime receipts to the current image and source heads.
// This reconciles verification metadata after independently running prerequisites.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(path.join(root,f),'utf8')).replace(/^\uFEFF/,'')),file=path.join(root,'var/config/runner.json'),runner=await load('var/config/runner.json');
const receipts={frontend:'phase6-runtime-4bb6361e08008acba5a57337a9020660',backend:'phase7-runtime-8f8da1ac621b215aeec7bdbf84984621',feature:'phase8-runtime-e5fbb75eea841b9e86b6a5dd3b8820c6'};
for(const [profile,folder]of Object.entries(receipts)){
 const evidence=`var/evidence/${folder}`,suite=await load(evidence+'/report.json'),result=(await load(evidence+'/run_checks.json.out')).result;
 const source=path.join(root,'var/fixtures',profile),git=args=>{const r=spawnSync('git',['-c',`safe.directory=${source}`,'-C',source,...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Source identity unavailable');return r.stdout.trim();};
 if(result.image!==runner.image||suite.checks.some(c=>c.result!=='PASS')||result.report.checks.length!==(profile==='backend'?26:profile==='feature'?22:20)||result.report.checks.some(c=>c.result!=='PASS')||git(['status','--porcelain'])||git(['rev-parse','HEAD'])!==result.report.identity.base_commit)throw Error('Current runner receipt does not verify '+profile);
 runner[profile==='frontend'?'verified':profile+'_verified']=true;runner[profile==='frontend'?'evidence':profile+'_evidence']=evidence;
}
await fs.writeFile(file+'.phase8.tmp',JSON.stringify(runner,null,2));await fs.rename(file+'.phase8.tmp',file);console.log('Current image verified for frontend, backend and feature from matching real receipts.');
