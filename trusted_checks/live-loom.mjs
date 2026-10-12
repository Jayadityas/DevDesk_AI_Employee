// Read-only readiness checks: no submissions, votes or model inference.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const load=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const demo=await load(path.join(root,'var/evidence/live-loom-latest.json'));
const {chromium}=createRequire(path.join(root,'tools/package.json'))('playwright');
const checks=[];let server,browser;
function check(name,good){checks.push({name,result:good?'PASS':'FAIL'});if(!good)throw Error(name);}
try{
 server=spawn('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Start-LiveLoomWorkbench.ps1','-RunForSeconds','25'],{cwd:root,windowsHide:true,stdio:'ignore'});
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:8116')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8116');
 const account=(await load(demo.accounts)).find(a=>a.username==='asha');
 await page.locator('[name=username]').fill(account.username);await page.locator('[name=password]').fill(account.password);await page.locator('#login-form button').click();await page.locator('#workspace').waitFor();
 await page.locator('#records .empty').waitFor();check('fresh_authenticated_queue_is_empty',(await page.locator('#records').innerText()).includes('The queue is clear'));
 await page.locator('[data-view=history]').click();await page.waitForFunction(()=>document.querySelector('#records')?.textContent.includes('No completed'));check('fresh_history_is_empty',(await page.locator('#records').innerText()).includes('No completed'));
 const todo=await (await fetch('http://127.0.0.1:8082/api/tasks?status=todo')).json();
 const done=await (await fetch('http://127.0.0.1:8082/api/tasks?status=done')).json();
 const tasks=value=>Array.isArray(value)?value:value.tasks;
 check('backend_original_todo_defect_is_live',tasks(todo).length===4&&tasks(todo).some(t=>t.status!=='todo'));
 check('backend_done_control_is_correct',tasks(done).length===1&&tasks(done).every(t=>t.status==='done'));
 await page.goto('http://127.0.0.1:8083');check('feature_original_completed_filter_is_absent',await page.locator('[data-filter=done]').count()===0);
 check('no_browser_script_errors',errors.length===0);
}catch(error){checks.push({name:'live_demo_readiness',result:'FAIL',detail:error.message});process.exitCode=1;}
finally{if(browser)await browser.close();if(server?.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}
await fs.writeFile(path.join(demo.directory,'readiness-report.json'),JSON.stringify({checks,new_model_calls:0,new_reports:0},null,2));
console.log(JSON.stringify({pass:checks.filter(c=>c.result==='PASS').length,fail:checks.filter(c=>c.result==='FAIL').length,new_model_calls:0,new_reports:0}));
