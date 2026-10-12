// Independent database oracle, private evaluator UID and report directory.
import {execFileSync} from 'node:child_process';import crypto from 'node:crypto';
const origin='http://127.0.0.1:8080',db='/tmp/app-data/tasks.db';
function rows(){return JSON.parse(execFileSync('/opt/runner/db-read',[],{encoding:'utf8',timeout:3000})||'[]');}
const normalize=tasks=>JSON.stringify(tasks.map(t=>({id:t.id,title:t.title,description:t.description,status:t.status,created_at:t.created_at})).sort((a,b)=>a.id-b.id));
async function api(url,method='GET',data){const r=await fetch(origin+url,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,redirect:'error',signal:AbortSignal.timeout(5000)});return {status:r.status,body:await r.json()};}
export async function baselineDatabaseChecks(check){
 const seeded=rows();check('evaluator_user_separated',process.getuid()===10002);check('seed_matches_database',JSON.stringify(seeded.map(t=>[t.id,t.status]))==='[[1,"todo"],[2,"todo"],[3,"in_progress"],[4,"done"]]');
 let correct=normalize((await api('/api/tasks')).body.tasks)===normalize(seeded);for(const status of ['todo','in_progress','done'])correct&&=normalize((await api('/api/tasks?status='+status)).body.tasks)===normalize(seeded.filter(t=>t.status===status));check('filter_matches_database',correct);
 const before=normalize(rows());for(const status of ['', 'todo','in_progress','done'])await api('/api/tasks?status='+status);check('database_preserved_by_reads',normalize(rows())===before);
}
export async function mutationDatabaseChecks(check){
 let correct=true;for(const status of ['todo','in_progress','done']){const title='Independent '+crypto.randomBytes(8).toString('hex'),created=await api('/api/tasks','POST',{title,description:'Synthetic independent sample',status});correct&&=created.status===201&&created.body.title===title&&created.body.status===status;}
 const sample=rows();for(const status of ['todo','in_progress','done'])correct&&=normalize((await api('/api/tasks?status='+status)).body.tasks)===normalize(sample.filter(t=>t.status===status));
 if(sample.length){const id=sample.at(-1).id;await api('/api/tasks/'+id,'PATCH',{status:'todo'});const changed=rows();correct&&=normalize((await api('/api/tasks?status=todo')).body.tasks)===normalize(changed.filter(t=>t.status==='todo'));}
 check('filter_after_mutations',correct);const invalid=await api('/api/tasks?status=invalid');const duplicate=await api('/api/tasks?status=todo&status=done');check('invalid_filter_rejected',invalid.status===400&&duplicate.status===400);
}
