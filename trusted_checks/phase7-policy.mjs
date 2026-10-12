import fs from 'node:fs/promises';import path from 'node:path';import {repairProfile,assertBackendScope} from '../tools/repair-profile.mjs';
const root=path.resolve(import.meta.dirname,'..'),before=(await fs.readFile(path.join(root,'var/fixtures/backend/src/task_repository.cpp'),'utf8')).trim(),checks=[];
const good=before.replace(" OR ?1 = 'todo'",'');
const deny=(name,f)=>{let denied=false;try{f()}catch{denied=true}checks.push({name,result:denied?'PASS':'FAIL'})};
try{assertBackendScope(before,good);checks.push({name:'minimal_function_edit_allowed',result:'PASS'})}catch{checks.push({name:'minimal_function_edit_allowed',result:'FAIL'})}
deny('constructor_edit_denied',()=>assertBackendScope(before,before.replace('sqlite3_busy_timeout(db_, 3000)','sqlite3_busy_timeout(db_, 0)')));
deny('seed_edit_denied',()=>assertBackendScope(before,before.replace("'Plan the team kickoff'","'Changed seed'")));
deny('new_global_function_denied',()=>assertBackendScope(before,before.replace('Task TaskRepository::get_task','void escape() {}\nTask TaskRepository::get_task')));
deny('signature_change_denied',()=>assertBackendScope(before,before.replace('list_tasks(const std::string& status)','list_tasks(std::string status)')));
deny('unknown_profile_denied',()=>repairProfile('../../playground'));
checks.push({name:'profile_paths_are_fixed',result:repairProfile('backend').file==='src/task_repository.cpp'&&repairProfile().file==='static/styles.css'?'PASS':'FAIL'});
const directory=path.join(root,'var/evidence',`phase7-policy-${Date.now()}`);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({mode:'actual_policy_functions_known_patch_only_in_test_memory',checks},null,2));const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));
