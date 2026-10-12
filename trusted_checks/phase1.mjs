// Trusted developer checks. Never mount this file writable in a repair task.
// No model stubs or repair code: observations come from actual API/browser execution.
import { chromium } from '../tools/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
const output = join(root, 'var', 'evidence', runId);
await mkdir(output, { recursive: true });
const report = { run_id: runId, started_at: new Date().toISOString(), live_model_calls: 0, scope: 'Phase 1 developer-authored app only; no autonomous repair or sandbox claim', scenarios: [] };
let activeServer;
let browser;

function record(scenario, name, condition, observation, evidence = null) {
  scenario.assertions.push({ name, status: condition ? 'PASS' : 'FAIL', observation, evidence });
}
async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function launch(source, db, scenarioName) {
  const port = await unusedPort();
  const executable = join(source, 'build', 'team-tasks.exe');
  const child = spawn(executable, ['--db', db, '--static', join(source, 'build', 'static'), '--port', String(port), '--scenario', scenarioName], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  activeServer = child;
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try {
      const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(500) });
      if (response.ok) return { child, origin, logs: () => logs };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server readiness timeout: ${logs}`);
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'exit');
  child.kill();
  await closed;
  if (activeServer === child) activeServer = null;
}
async function request(origin, path, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(origin + path, { method, headers: { ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...extraHeaders }, ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {}), signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data };
}
const ids = tasks => tasks.map(task => task.id).join(',');

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browser_version=browser.version();
  report.node_version=process.version;
  for (const name of ['clean', 'frontend', 'backend', 'feature']) {
    const source = name === 'clean' ? join(root, 'playground') : join(root, 'var', 'fixtures', name);
    const executable = join(source, 'build', 'team-tasks.exe');
    if (!existsSync(executable)) throw new Error(`Build missing for ${name}`);
    const db = join(output, `${name}.db`);
    execFileSync(executable, ['--db', db, '--seed'], { windowsHide: true, timeout: 5000 });
    let server = await launch(source, db, name);
    let origin = server.origin;
    const scenario = { name, metadata: (await request(origin, '/api/health')).data, assertions: [] };
    report.scenarios.push(scenario);
    scenario.build_info = JSON.parse((await readFile(join(source,'build','build-info.json'),'utf8')).replace(/^\uFEFF/,''));
    record(scenario, 'commit_and_build_recorded', /^[a-f0-9]{40}$/.test(scenario.metadata.commit) && /^[a-f0-9]{64}$/.test(scenario.metadata.build), scenario.metadata);
    record(scenario, 'metadata_matches_build', scenario.metadata.commit === scenario.build_info.commit && scenario.metadata.build === scenario.build_info.build, scenario.build_info);
    const all = await request(origin, '/api/tasks');
    record(scenario, 'seed_exact_rows', all.status === 200 && ids(all.data.tasks) === '1,2,3,4' && all.data.tasks.map(t=>t.status).join(',') === 'todo,todo,in_progress,done', all);
    for (const [status, expected] of [['todo','1,2'],['in_progress','3'],['done','4']]) {
      const result = await request(origin, `/api/tasks?status=${status}`);
      record(scenario, `api_filter_${status}`, result.status === 200 && ids(result.data.tasks) === expected, {expected_ids:expected, result});
    }
    for (const query of ['status=unknown','status=','status=todo&status=done',"status=todo%27%20OR%201%3D1--",'extra=1']) {
      const result = await request(origin, '/api/tasks?' + query);
      record(scenario, 'reject_query_' + query, result.status === 400, result);
    }
    for (const [label, body] of [['blank',{title:'  '}],['too_long',{title:'x'.repeat(121)}],['wrong_type',{title:42}],['unknown_field',{title:'task',permission:'admin'}],['bad_status',{title:'task',status:'invalid'}],['missing',{}],['malformed','{'],['not_object',[]],['nul',{title:'a\u0000b'}]]) {
      const result = await request(origin, '/api/tasks', 'POST', body);
      record(scenario, 'reject_create_' + label, result.status === 400, result);
    }
    const crossOrigin = await request(origin, '/api/tasks','POST',{title:'Unwanted cross-origin task'},{Origin:'https://untrusted.example'});
    record(scenario,'deny_cross_origin_write',crossOrigin.status === 403,crossOrigin);
    const missing = await request(origin, '/api/tasks/999999','PATCH',{status:'done'});
    record(scenario,'missing_task_404',missing.status === 404,missing);
    const invalidPatch = await request(origin, '/api/tasks/1','PATCH',{status:'unexpected'});
    record(scenario,'reject_invalid_update',invalidPatch.status === 400,invalidPatch);
    const oversizedId = await request(origin, '/api/tasks/99999999999999999999999999','DELETE');
    record(scenario,'reject_overflow_id',oversizedId.status === 400,oversizedId);
    const advanced = await request(origin, '/api/tasks/1','PATCH',{status:'in_progress'});
    record(scenario,'api_status_update',advanced.status === 200 && advanced.data.status === 'in_progress',advanced);
    await request(origin, '/api/tasks/1','PATCH',{status:'todo'});
    const created = await request(origin, '/api/tasks','POST',{title:"Persistent O'Reilly <script> task", description:'Restart persistence probe'});
    record(scenario,'api_create',created.status === 201 && created.data.status === 'todo',created);
    await stop(server.child);
    server = await launch(source,db,name);
    origin = server.origin;
    const afterRestart = await request(origin,'/api/tasks');
    record(scenario,'restart_persistence',afterRestart.data.tasks.some(task=>task.id === created.data.id && task.title === created.data.title),afterRestart);
    const removed = await request(origin, `/api/tasks/${created.data.id}`,'DELETE');
    const removedAgain = await request(origin, `/api/tasks/${created.data.id}`,'DELETE');
    record(scenario,'delete_and_missing',removed.status === 204 && removedAgain.status === 404,{removed,removedAgain});
    const browserErrors = [];
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    page.on('pageerror',error=>browserErrors.push(error.message));
    for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
      await page.setViewportSize(viewport);
      await page.goto(origin);
      await page.locator('.task-card').nth(3).waitFor();
      await page.locator('#task-list[aria-busy="false"]').waitFor();
      const screenshotName = `${name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({path:join(output,screenshotName),fullPage:true});
      const geometry = await page.locator('.task-card').evaluateAll(cards=>cards.map(card=>{
        const rectangle = element => {
          const r = element.getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
        };
        const buttons = [...card.querySelectorAll('.task-actions button')];
        const [a,b] = buttons.map(rectangle);
        const parent = rectangle(card);
        const overlap = Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
        return {id:card.dataset.taskId,a,b,overlap,visible:buttons.every(button=>{const r=rectangle(button);return r.width>0 && r.height>0 && !button.disabled && getComputedStyle(button).visibility!=='hidden' && getComputedStyle(button).display!=='none' && r.x>=parent.x && r.right<=parent.right+.1 && r.y>=parent.y && r.bottom<=parent.bottom+.1;})};
      }));
      record(scenario,`geometry_${viewport.width}`,geometry.length === 4 && geometry.every(card=>card.overlap===0 && card.visible),geometry,screenshotName);
      const horizontalOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
      record(scenario,`no_page_overflow_${viewport.width}`,!horizontalOverflow,{horizontalOverflow},screenshotName);
      record(scenario,`card_content_${viewport.width}`,await page.locator('.task-card h3').allTextContents().then(t=>t.join('|') === 'Plan the team kickoff|Review the design notes|Build the task board|Prepare the demo checklist'),await page.locator('.task-card h3').allTextContents(),screenshotName);
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'To do',exact:true}).click();
    await page.locator('#task-list[aria-busy="false"]').waitFor();
    const filteredIds = await page.locator('.task-card').evaluateAll(cards=>cards.map(card=>card.dataset.taskId).join(','));
    record(scenario,'ui_todo_filter',filteredIds === '1,2',{expected:'1,2',actual:filteredIds});
    await page.getByRole('button',{name:'All tasks',exact:true}).click();
    await page.locator('#task-list[aria-busy="false"]').waitFor();
    await page.locator('[data-task-id="1"] .advance').click();
    await page.getByRole('status').filter({hasText:'Task status updated.'}).waitFor();
    await page.locator('#task-list[aria-busy="false"]').waitFor();
    const updated = (await request(origin,'/api/tasks')).data.tasks.find(task=>task.id === 1);
    record(scenario,'mobile_advance_click',updated.status === 'in_progress',updated);
    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Complete task'}).waitFor();
    const completeResponse = page.waitForResponse(response=>response.url().endsWith('/api/tasks/1') && response.request().method()==='PATCH');
    await page.locator('[data-task-id="1"] .advance').click();
    await completeResponse;
    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Reopen task'}).waitFor();
    const completed = (await request(origin,'/api/tasks')).data.tasks.find(task=>task.id === 1);
    record(scenario,'mobile_complete_click',completed.status === 'done',completed);
    const reopenResponse = page.waitForResponse(response=>response.url().endsWith('/api/tasks/1') && response.request().method()==='PATCH');
    await page.locator('[data-task-id="1"] .advance').click();
    await reopenResponse;
    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Start task'}).waitFor();
    const reopened = (await request(origin,'/api/tasks')).data.tasks.find(task=>task.id === 1);
    record(scenario,'mobile_reopen_click',reopened.status === 'todo',reopened);
    await page.reload();
    await page.locator('.task-card').nth(3).waitFor();
    await page.locator('#title').fill('<img src=x onerror="window.taskXss=1">');
    await page.locator('#description').fill('Created through the browser');
    await page.getByRole('button',{name:'Create task',exact:false}).click();
    await page.getByRole('status').filter({hasText:'Task created and saved.'}).waitFor();
    await page.locator('.task-card').nth(4).waitFor();
    await page.reload();
    const injected = page.locator('.task-card').filter({has:page.locator('h3',{hasText:'<img src=x onerror="window.taskXss=1">'})});
    await injected.waitFor();
    record(scenario,'browser_create_refresh_text_safety',await injected.locator('h3').textContent() === '<img src=x onerror="window.taskXss=1">' && await page.evaluate(()=>!window.taskXss && document.querySelectorAll('.task-card img').length===0),{title:await injected.locator('h3').textContent()});
    page.once('dialog',dialog=>dialog.accept());
    await injected.locator('.remove').click();
    await page.getByRole('status').filter({hasText:'Task removed.'}).waitFor();
    await page.locator('#task-list[aria-busy="false"]').waitFor();
    record(scenario,'mobile_remove_click',await page.locator('.task-card').count()===4,{cards:await page.locator('.task-card').count()});
    const completedFilter = await page.locator('[data-filter="done"]').count();
    record(scenario,'completed_feature_acceptance',completedFilter === 1,{expected_completed_control:1,actual:completedFilter,meaning:'Intentionally absent feature; API done filter is independently checked.'});
    for (const id of [1,2,3,4]) await request(origin,`/api/tasks/${id}`,'DELETE');
    await page.reload();
    await page.locator('#empty').waitFor({state:'visible'});
    record(scenario,'empty_state',await page.locator('.task-card').count()===0 && await page.locator('#task-count').textContent()==='0 tasks',{message:await page.locator('#empty').textContent()});
    record(scenario,'browser_no_exceptions',browserErrors.length===0,browserErrors);
    await context.close();
    await stop(server.child);
    // Exercise reset on an existing, modified synthetic database only after stopping its server.
    execFileSync(executable,['--db',db,'--seed'],{windowsHide:true,timeout:5000});
    server = await launch(source,db,name);
    const resetRows = await request(server.origin,'/api/tasks');
    record(scenario,'developer_reset_restores_seed',ids(resetRows.data.tasks)==='1,2,3,4' && resetRows.data.tasks.map(t=>t.status).join(',')==='todo,todo,in_progress,done',resetRows);
    await stop(server.child);
    const expectedFailures = ['completed_feature_acceptance',...(name === 'frontend' ? ['geometry_390'] : []),...(name === 'backend' ? ['api_filter_todo','ui_todo_filter'] : [])].sort();
    const actualFailures = scenario.assertions.filter(a=>a.status==='FAIL').map(a=>a.name).sort();
    scenario.expected_baseline_failures=expectedFailures;
    scenario.observed_failures=actualFailures;
    scenario.baseline_matches_expected = JSON.stringify(actualFailures) === JSON.stringify(expectedFailures);
    console.log(`${name}: ${scenario.assertions.filter(a=>a.status==='PASS').length} PASS, ${actualFailures.length} FAIL; fixture matches expected=${scenario.baseline_matches_expected}`);
  }
} catch (error) {
  report.execution_error=error.stack;
  console.error(error.stack);
} finally {
  await stop(activeServer);
  if (browser) await browser.close();
  report.finished_at=new Date().toISOString();
  report.phase1_passed=!report.execution_error && report.scenarios.length===4 && report.scenarios.every(s=>s.baseline_matches_expected);
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(root,'var','evidence','latest.json'),JSON.stringify({run_id:runId,report:join(output,'report.json'),phase1_passed:report.phase1_passed},null,2));
  console.log(`Evidence: ${output}`);
  console.log(`Phase 1 checks: ${report.phase1_passed?'PASS (including recorded expected defects)':'FAIL'}`);
  process.exitCode=report.phase1_passed?0:1;
}
