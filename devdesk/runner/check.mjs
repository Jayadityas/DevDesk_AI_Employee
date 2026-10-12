// Trusted evaluator lives in the read-only image, never the editable checkout.
import fs from 'node:fs/promises';
import {spawn, execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {buildTask} from './runtime-build.mjs';
import {baselineDatabaseChecks,mutationDatabaseChecks} from './backend-checks.mjs';
const backend=process.env.DEVDESK_PROFILE==='backend';
const checks = [], check = (name, good) => { checks.push({name, result: good ? 'PASS' : 'FAIL'}); };
await fs.mkdir('/tmp/evidence', {recursive:true,mode:0o700});
let app, browser,identity;
async function deniedWrite(file) { try { await fs.writeFile(file, 'forbidden'); return false; } catch { return true; } }
if (process.argv[2] === 'canary') {
 check('non_root', [10001,10002].includes(process.getuid()));
 check('root_read_only', await deniedWrite('/opt/runner/escape'));
 check('checkout_read_only', await deniedWrite('/input/escape'));
 check('no_host_control_plane', !(await fs.stat('/input/var/config/model.json').catch(()=>null)) && !(await fs.stat('/var/run/docker.sock').catch(()=>null)));
 check('no_model_credentials', !Object.keys(process.env).some(k=> /API_KEY|PGPASSWORD|OPENAI|GEMINI/.test(k)));
 let network = false; try { await fetch('https://example.com', {signal:AbortSignal.timeout(2000)}); network=true; } catch {}
 check('external_network_denied', !network);
 const status = await fs.readFile('/proc/self/status','utf8');
 check('no_new_privileges', /NoNewPrivs:\s+1/.test(status));
 check('capabilities_dropped', /CapEff:\s+0+\s/.test(status));
 await fs.writeFile('/tmp/evidence/report.json',JSON.stringify({checks}));
 setInterval(()=>{},1000);await new Promise(()=>{});
}
if (process.argv[2] === 'timeout_canary') { setInterval(()=>{},1000);await new Promise(()=>{}); }
try {
 identity=await buildTask();
 check('build',true);
 if(backend){
  if(process.getuid()!==10002)throw Error('Wrong evaluator user');
  async function protect(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=folder+'/'+entry.name;if(entry.isDirectory())await protect(file);else await fs.chmod(file,0o444);}await fs.chmod(folder,0o555);}
  await protect('/tmp/task');await fs.chmod('/tmp/team-tasks',0o555);await fs.writeFile('/tmp/build-ready.json',JSON.stringify(identity));
 }else{execFileSync('/tmp/team-tasks',['--db','/tmp/tasks.db','--seed'],{timeout:5000});app=spawn('/tmp/team-tasks',['--db','/tmp/tasks.db','--static','/tmp/task/static','--port','8080','--scenario','candidate'],{stdio:'ignore'});}
 for(let i=0;i<200;i++){try{if((await fetch('http://127.0.0.1:8080/api/health')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 const origin='http://127.0.0.1:8080';
 const health=await(await fetch(`${origin}/api/health`)).json();check('app_source_identity',health.commit===identity.base_commit&&health.build===identity.source_sha256);
 const all=await (await fetch(`${origin}/api/tasks`)).json();
 check('seeded_tasks',Array.isArray(all.tasks)&&all.tasks.length===4);
 if(backend)await baselineDatabaseChecks(check);
 for(const status of ['todo','in_progress','done']){
  const filtered=await(await fetch(`${origin}/api/tasks?status=${status}`)).json();
  check(`filter_${status}`,JSON.stringify(filtered.tasks.map(t=>t.id).sort())===JSON.stringify(all.tasks.filter(t=>t.status===status).map(t=>t.id).sort()));
 }
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}), page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin||!(['/','/index.html','/app.js','/styles.css','/api/tasks','/api/health'].includes(u.pathname)||/^\/api\/tasks\/\d+$/.test(u.pathname)))return route.abort();
   try{const response=await route.fetch({maxRedirects:0,timeout:5000});if(response.status()>=300&&response.status()<400)return route.abort();await route.fulfill({response});}catch{return route.abort();}
  });
  await page.goto(origin);await page.locator('.task-card').first().waitFor();
  const facts=await page.locator('.task-card').evaluateAll(cards=>cards.map(card=>{
   const buttons=[...card.querySelectorAll('button')].map(b=>{let visible=true;for(let node=b;node;node=node.parentElement){const style=getComputedStyle(node);visible&&=style.visibility==='visible'&&Number(style.opacity)>0&&style.display!=='none';}return {r:b.getBoundingClientRect().toJSON(),disabled:b.disabled,visible};});
   if(buttons.length<2)return {valid:false};const [a,b]=buttons.map(b=>b.r);
   return {valid:a.width>0&&a.height>0&&b.width>0&&b.height>0&&!buttons.some(b=>b.disabled||!b.visible),overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))};
  }));
  check(`action_buttons_separate_${viewport.width}`,facts.length===4&&facts.every(f=>f.valid&&f.overlap===0));
  check(`no_horizontal_overflow_${viewport.width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`no_script_errors_${viewport.width}`,errors.length===0);
  if(process.env.DEVDESK_PROFILE==='feature'){
   let passed=false;
   try{const filter=page.locator('[data-filter="done"]');if(await filter.count()===1&&await filter.isVisible()&&await filter.isEnabled()){await filter.click();await page.waitForFunction(()=>document.querySelector('#task-list').getAttribute('aria-busy')==='false');const expected=await(await fetch(origin+'/api/tasks?status=done')).json();const actual=await page.locator('.task-card').evaluateAll(cards=>cards.map(c=>({id:Number(c.dataset.taskId),done:!!c.querySelector('.status-badge.done')})));passed=actual.length===expected.tasks.length&&actual.every(c=>c.done)&&JSON.stringify(actual.map(c=>c.id).sort())===JSON.stringify(expected.tasks.map(t=>t.id).sort())&&await filter.getAttribute('aria-pressed')==='true';}}catch{}
   check(`completed_filter_${viewport.width}`,passed);
  }
  const height=await page.evaluate(()=>document.documentElement.scrollHeight);
  await page.screenshot({path:`/tmp/evidence/${viewport.width}.png`,fullPage:height<=4096});
  if(process.env.DEVDESK_PROFILE==='feature'){await page.locator('[data-filter=""]').click();await page.waitForFunction(()=>document.querySelector('#task-list').getAttribute('aria-busy')==='false');}
  // Real, unforced browser interactions detect CSS that makes controls unusable.
  try {
   page.setDefaultTimeout(6000);page.on('dialog',dialog=>dialog.accept());
   const title=`Independent browser check ${viewport.width}`;
   await page.locator('#title').fill(title);await page.locator('#description').fill('Synthetic UI check');await page.locator('#create-button').click();
   const card=page.locator('.task-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
   await card.waitFor();check(`browser_create_${viewport.width}`,await card.count()===1);
   await card.locator('.advance').click();await card.locator('.status-badge.in_progress').waitFor();check(`browser_advance_${viewport.width}`,true);
   await card.locator('.remove').click();await card.waitFor({state:'detached'});check(`browser_remove_${viewport.width}`,true);
  } catch(error) {checks.push({name:`browser_interactions_${viewport.width}`,result:'FAIL',detail:error.message.slice(0,200)});}
  await context.close();
 }
 const created=await fetch(`${origin}/api/tasks`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Independent candidate check',description:'Synthetic persistence check'})});
 const row=await created.json();check('create_task',created.status===201&&row.title==='Independent candidate check');
 if(row.id){const changed=await fetch(`${origin}/api/tasks/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})});check('advance_task',changed.ok);}
 if(backend)await mutationDatabaseChecks(check);
}catch(error){checks.push({name:'runner_execution',result:'UNKNOWN',detail:error.message.slice(0,300)});}
finally{if(browser)await browser.close();if(app)app.kill();}
await fs.writeFile('/tmp/evidence/report.json',JSON.stringify({checks,identity,scope:backend?'backend list_tasks candidate; independent SQLite/API checks':'frontend CSS candidate; fixed independent checks'}));
// Keep tmpfs artifacts alive until the trusted host exports them and removes this container.
setInterval(()=>{},1000);await new Promise(()=>{});
