// Real provider pilot. No scripted adapter or automatic retry of model calls.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
const root = path.resolve(import.meta.dirname, '..');
const load = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const modelFile = path.join(root, 'var/config/model.json');
const model = await load(modelFile);
if (!['openai', 'gemini'].includes(model.provider) || !model.api_key?.trim()) {
 console.log('Live verification pending: configure ignored var/config/model.json locally. No model call or ticket claim performed.'); process.exit(2);
}
const release = (await load(path.join(root, 'devdesk/build/latest.json'))).directory;
const exe = path.join(release, 'devdesk.exe');
function command(file, args) { const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', windowsHide: true }); if (result.status !== 0) throw new Error(`Trusted command failed: ${path.basename(file)}; ${result.stderr?.slice(0, 200) || 'details withheld'}`); return result.stdout; }
// Availability/TLS/auth GET before billing, useful for network diagnostics without replaying a decision.
console.log(command(exe, ['--model-access', modelFile]).trim());
if (process.argv.includes('--probe-only')) process.exit(0);
const directory = path.join(root, 'var/evidence', `phase3-live-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`);
await fs.mkdir(directory, { recursive: true });
const processes = new Set(), checks = [], started = Date.now();
let user, ticket, evidence, existingData;
const base = 'http://127.0.0.1:8099';
function check(name, condition) { checks.push({ name, result: condition ? 'PASS' : 'FAIL' }); if (!condition) throw new Error(`Assertion failed: ${name}`); }
async function free(port) { return new Promise(resolve => { const server = net.createServer(); server.on('error', () => resolve(false)); server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolve(true))); }); }
async function start(file, args, port) { if (!await free(port)) throw new Error(`Port ${port} occupied; existing service preserved`); const child = spawn(file, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); processes.add(child); child.stdout.resume(); child.stderr.resume(); for (let i = 0; i < 100; ++i) { if (child.exitCode !== null) throw new Error('Pilot server failed'); try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return child; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Pilot server timeout'); }
async function stop(child) { if (child.exitCode === null) { const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done; } processes.delete(child); }
async function call(endpoint, { method = 'GET', data, form, key } = {}) { const headers = { Connection: 'close' }; if (user) { headers.Cookie = user.cookie; if (method !== 'GET') headers['X-CSRF-Token'] = user.csrf; } if (data !== undefined) headers['Content-Type'] = 'application/json'; if (key) headers['Idempotency-Key'] = key; const response = await fetch(base + endpoint, { method, headers, body: form || (data === undefined ? undefined : JSON.stringify(data)) }); const body = await response.json(); if (!response.ok) throw new Error(`Pilot API failed: ${body.error || response.status}`); return { body, headers: response.headers }; }
try {
 const source = path.join(root, 'var/fixtures/frontend');
 if (await free(8081)) { const database = path.join(directory, 'frontend.db'), app = path.join(source, 'build/team-tasks.exe'); command(app, ['--db', database, '--seed']); await start(app, ['--db', database, '--static', path.join(source, 'build/static'), '--port', '8081', '--scenario', 'frontend'], 8081); }
 else existingData = await (await fetch('http://127.0.0.1:8081/api/tasks')).text();
 command('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tools/Setup-Phase2Test.ps1', '-RunDirectory', directory]);
 command(exe, ['--seed', path.join(directory, 'test-config.json'), path.join(directory, 'accounts.json')]);
 await start(exe, ['--serve', path.join(directory, 'test-config.json'), '8099', path.join(release, 'static')], 8099);
 const account = (await load(path.join(directory, 'accounts.json'))).find(a => a.username === 'asha');
 const login = await call('/api/login', { method: 'POST', data: { username: 'asha', password: account.password } }); user = { cookie: login.headers.get('set-cookie').split(';')[0] }; user.csrf = (await call('/api/me')).body.csrf;
 const screenshot = await fs.readFile(path.join(root, 'var/evidence/2026-10-10T15-55-30-050Z-45764/frontend-390x844.png'));
 const form = new FormData(); form.append('screenshot', new Blob([screenshot], { type: 'image/png' }), 'synthetic-frontend-report.png');
 const upload = (await call('/api/uploads', { method: 'POST', form })).body.id;
 ticket = (await call('/api/requests', { method: 'POST', key: crypto.randomUUID(), data: { project_id: 1, kind: 'bug', title: 'Task action buttons overlap on mobile', description: 'At 390 Ã— 844, task-card action buttons visually overlap. Please independently investigate and explain the observed behavior.', reproduction: 'Open the task board, scroll to task cards, and inspect the Start/Complete and Remove buttons. Compare another viewport if useful.', page_url: 'http://127.0.0.1:8081/', viewport_width: 390, viewport_height: 844, reported_impact: 'cosmetic', upload_id: upload } })).body.ticket.id;
 const child = spawn(exe, ['--worker', path.join(directory, 'test-config.json'), modelFile, root], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); processes.add(child); child.stdout.resume(); child.stderr.resume();
 const timer = setInterval(() => console.log(JSON.stringify({ status: 'Live investigation in progress', elapsed_ms: Date.now() - started })), 20000);
 const exit = await new Promise(resolve => child.once('exit', resolve)); clearInterval(timer); processes.delete(child);
 evidence = (await call(`/api/tickets/${ticket}`)).body;
 await fs.writeFile(path.join(directory, 'redacted-trace.json'), JSON.stringify(evidence, null, 2));
 check('Live worker finished without repair', exit === 0 && evidence.ticket.state === 'INVESTIGATED_READ_ONLY');
 check('Live calls and configured model recorded', evidence.runs[0].mode === 'live' && Number(evidence.runs[0].model_calls) > 0 && evidence.runs[0].model === model.model);
 check('Model selected project context and source reads', evidence.observations.some(o => o.tool === 'project_instructions') && evidence.observations.some(o => o.tool === 'source_read'));
 check('Model selected real browser reproduction', evidence.observations.some(o => o.tool === 'browser_observe' && JSON.parse(o.result).assertions.some(a => a.name === 'action_buttons_separate' && a.result === 'FAIL')));
 check('Reproduced conclusion bound to evidence', evidence.ticket.confirmed === 't' && evidence.runs[0].verdict === 'reproduced');
 check('Usage and cost measured within configured limits', Number(evidence.runs[0].input_tokens) > 0 && Number(evidence.runs[0].estimated_usd) <= model.max_usd);
 check('No fixture source edit', command('git', ['-c', `safe.directory=${source}`, '-C', source, 'status', '--porcelain']).trim() === '');
 if (existingData !== undefined) check('Existing frontend data preserved', await (await fetch('http://127.0.0.1:8081/api/tasks')).text() === existingData);
 await fs.writeFile(path.join(directory, 'redacted-trace.json'), JSON.stringify(evidence, null, 2));
} catch (error) { checks.push({ name: 'Live run completion', result: 'FAIL', detail: error.message }); process.exitCode = 1; }
finally {
 for (const child of processes) await stop(child);
 const report = { phase: 3, mode: 'live', model: model.model, prompt_version: evidence?.runs?.[0]?.prompt_version, build: await load(path.join(release, 'build-info.json')), duration_ms: Date.now() - started, ticket_id: ticket, run: evidence?.runs?.[0], checks, totals: { pass: checks.filter(c => c.result === 'PASS').length, fail: checks.filter(c => c.result === 'FAIL').length }, live_model_verified: checks.length > 0 && checks.every(c => c.result === 'PASS') };
 await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2)); await fs.writeFile(path.join(root, 'var/evidence/phase3-live-latest.json'), JSON.stringify({ report: path.relative(root, path.join(directory, 'report.json')) }, null, 2)); console.log(JSON.stringify({ report: path.relative(root, path.join(directory, 'report.json')), ...report.totals, live_model_verified: report.live_model_verified }));
}

