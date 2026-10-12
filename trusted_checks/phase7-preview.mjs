// Read-only verification of the accepted backend preview; no task mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const {chromium}=createRequire(path.join(root,'tools/package.json'))('playwright');
const directory=path.join(root,'var/evidence',`phase7-preview-${Date.now()}`);
await fs.mkdir(directory,{recursive:true});
const checks=[],check=(name,good)=>checks.push({name,result:good?'PASS':'FAIL'});
const origin='http://127.0.0.1:8082';let browser;
try {
 const before=await(await fetch(origin+'/api/tasks')).text();
 const state=await load(path.join(root,'var/config/preview-backend.json'));
 const fixture=path.join(root,'var/fixtures/backend');
 const head=spawnSync('git',['-c',`safe.directory=${fixture}`,'-C',fixture,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout.trim();
 const health=await(await fetch(origin+'/api/health')).json();
 check('accepted_source_and_build_identity',health.commit===head&&state.commit===head&&health.build===state.build);
 check('backend_scenario_label',health.scenario==='backend');
 const todo=await(await fetch(origin+'/api/tasks?status=todo')).json();
 const done=await(await fetch(origin+'/api/tasks?status=done')).json();
 check('todo_has_only_seeded_todo_rows',todo.tasks.length===2&&todo.tasks.every(t=>t.status==='todo')&&todo.tasks.map(t=>t.id).join(',')==='1,2');
 check('done_has_only_seeded_done_row',done.tasks.length===1&&done.tasks[0].id===4&&done.tasks[0].status==='done');
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('.task-card').first().waitFor();
  await page.locator('[data-filter="todo"]').click();
  await page.waitForFunction(()=>document.querySelector('#task-count').textContent==='2 tasks'&&document.querySelector('#task-list').getAttribute('aria-busy')==='false');
  check(`todo_cards_correct_${width}`,await page.locator('.task-card').count()===2&&await page.locator('.status-badge.todo').count()===2);
  check(`no_overflow_${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`no_script_errors_${width}`,errors.length===0);
  await page.screenshot({path:path.join(directory,`${width}.png`),fullPage:true});await page.close();
 }
 check('read_only_check_preserves_tasks',await(await fetch(origin+'/api/tasks')).text()===before);
} catch(error) {checks.push({name:'preview_suite',result:'FAIL',detail:error.message});}
finally {if(browser)await browser.close();}
await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:7,mode:'real_readonly_backend_preview',checks},null,2));
const fail=checks.filter(c=>c.result==='FAIL').length;
console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));process.exitCode=fail?1:0;
