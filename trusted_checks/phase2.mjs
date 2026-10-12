import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('../tools/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');
const run = path.join(root, 'var', 'evidence', `phase2-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`);
await fs.mkdir(run, { recursive: true });
const started = Date.now();
const checks = [];
const processes = new Set();
let browser;
function check(name, condition, detail = '') { checks.push({ name, result: condition ? 'PASS' : 'FAIL', detail }); if (!condition) throw new Error(`Assertion failed: ${name}`); }
function command(file, args, options = {}) { const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', windowsHide: true, ...options }); if (result.status !== 0) throw new Error(`Trusted setup command failed: ${path.basename(file)} (credentials withheld)`); return result.stdout; }
function sql(statement, role = 'admin') {
 const secret = secrets[role === 'admin' ? 'admin' : 'app'];
 return command('C:/Program Files/PostgreSQL/17/bin/psql.exe', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '5433', '-U', role === 'admin' ? 'devdesk_admin' : 'devdesk_app', '-d', 'devdesk_demo'], { input: `SET search_path TO ${config.schema};\n${statement}`, env: { ...process.env, PGPASSWORD: secret } }).trim();
}
const load = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
let secrets, config, accounts, build;
const release = (await load(path.join(root, 'devdesk', 'build', 'latest.json'))).directory;
const executable = path.join(release, 'devdesk.exe');
const base = 'http://127.0.0.1:8095';
async function start(port = 8095) {
 const child = spawn(executable, ['--serve', path.join(run, 'test-config.json'), String(port), path.join(release, 'static')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
 processes.add(child); child.stdout.resume(); child.stderr.resume();
 for (let i = 0; i < 100; ++i) { if (child.exitCode !== null) throw new Error('Workbench startup failed'); try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return child; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
 throw new Error('Workbench startup timeout');
}
async function stop(child) { if (child.exitCode === null) { const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done; } processes.delete(child); }
async function call(endpoint, { user, method = 'GET', data, form, key, headers = {}, origin, port = 8095 } = {}) {
 const requestHeaders = { ...headers };
 if (user) { requestHeaders.Cookie = user.cookie; if (method !== 'GET') requestHeaders['X-CSRF-Token'] ??= user.csrf; }
 if (data !== undefined) requestHeaders['Content-Type'] = 'application/json';
 if (key) requestHeaders['Idempotency-Key'] = key;
 if (origin) requestHeaders.Origin = origin;
 const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method, headers: requestHeaders, body: form || (data === undefined ? undefined : JSON.stringify(data)) });
 const type = response.headers.get('content-type') || '';
 return { status: response.status, headers: response.headers, body: type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()) };
}
async function login(username) {
 const account = accounts.find(a => a.username === username);
 const response = await call('/api/login', { method: 'POST', data: { username, password: account.password } });
 check(`Login ${username}`, response.status === 200);
 const cookie = response.headers.get('set-cookie').split(';')[0];
 check(`HttpOnly/SameSite cookie ${username}`, /HttpOnly/.test(response.headers.get('set-cookie')) && /SameSite=Strict/.test(response.headers.get('set-cookie')));
 const profile = await call('/api/me', { user: { cookie } });
 check(`Authenticated profile ${username}`, profile.status === 200 && profile.body.username === username);
 return { cookie, csrf: profile.body.csrf, id: profile.body.id };
}
const report = (overrides = {}) => ({ project_id: 1, kind: 'bug', title: 'Todo filter returns unrelated tasks', description: 'Only todo tasks should appear. Other statuses appear.', reproduction: 'Open the backend fixture and choose Todo.', page_url: 'http://127.0.0.1:8082/', viewport_width: 390, viewport_height: 844, reported_impact: 'local_functional', ...overrides });
async function submit(user, data, key = crypto.randomUUID(), port = 8095) { return call('/api/requests', { user, method: 'POST', data, key, port }); }
function imageForm(bytes, mime = 'image/png', filename = '../../private.png') { const form = new FormData(); form.append('screenshot', new Blob([bytes], { type: mime }), filename); return form; }
try {
 build = await load(path.join(release, 'build-info.json'));
 command('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tools/Setup-Phase2Test.ps1', '-RunDirectory', run]);
 config = await load(path.join(run, 'test-config.json')); secrets = await load(path.join(root, 'var', 'config', 'postgres-admin.json'));
 command(executable, ['--seed', path.join(run, 'test-config.json'), path.join(run, 'accounts.json')]); accounts = await load(path.join(run, 'accounts.json'));
 let server = await start();
 check('Anonymous queue denied', (await call('/api/tickets')).status === 401);
 check('Malformed login rejected', (await call('/api/login', { method: 'POST', data: [] })).status === 400);
 check('Wrong password denied', (await call('/api/login', { method: 'POST', data: { username: 'asha', password: 'wrong' } })).status === 401);
 const asha = await login('asha'), ravi = await login('ravi'), outsider = await login('outsider');
 check('Outsider has no project membership', (await call('/api/me', { user: outsider })).body.projects.length === 0);
 check('Outsider queue denied', (await call('/api/tickets', { user: outsider })).status === 403);
 check('Outsider report denied', (await submit(outsider, report())).status === 403);
 check('CSRF protection', (await call('/api/requests', { user: asha, method: 'POST', data: report(), key: crypto.randomUUID(), headers: { 'X-CSRF-Token': 'wrong' } })).status === 403);
 check('Cross-origin write denied', (await call('/api/requests', { user: asha, method: 'POST', data: report(), key: crypto.randomUUID(), origin: 'https://attacker.example' })).status === 403);
 check('External URL denied', (await submit(asha, report({ page_url: 'https://example.com/' }))).status === 400);
 check('URL userinfo denied', (await submit(asha, report({ page_url: 'http://127.0.0.1:8080@evil.example/' }))).status === 400);
 check('Wrong project denied', (await submit(asha, report({ project_id: 2 }))).status === 400);
 check('Spoofed reporter rejected', (await submit(asha, { ...report(), employee_id: ravi.id })).status === 400);
 check('Bad viewport denied', (await submit(asha, report({ viewport_width: 10000 }))).status === 400);
 check('Noninteger viewport denied', (await submit(asha, report({ viewport_width: 390.5 }))).status === 400);
 check('Missing bug reproduction denied', (await submit(asha, report({ reproduction: '' }))).status === 400);
 check('Unknown impact denied', (await submit(asha, report({ reported_impact: 'urgent' }))).status === 400);
 check('Oversized title denied', (await submit(asha, report({ title: 'a'.repeat(121) }))).status === 400);
 check('Missing operation key denied', (await call('/api/requests', { user: asha, method: 'POST', data: report() })).status === 400);
 check('NUL text denied before SQL', (await submit(asha, report({ title: 'prefix\0suffix' }))).status === 400);
 check('Oversized description denied', (await submit(asha, report({ description: 'a'.repeat(4001) }))).status === 400);
 const image = await fs.readFile(path.join(root, 'var', 'evidence', '2026-10-10T15-55-30-050Z-45764', 'frontend-390x844.png')).catch(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); await page.goto(base); return page.screenshot();
 });
 const uploaded = await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(image) });
 check('PNG decoded and uploaded', uploaded.status === 201 && uploaded.body.width > 0);
 const uploadId = uploaded.body.id;
 check('Upload original bytes preserved', crypto.createHash('sha256').update((await call(`/api/uploads/${uploadId}`, { user: asha })).body).digest('hex') === crypto.createHash('sha256').update(image).digest('hex'));
 check('Random filename ignores traversal input', sql(`SELECT filename FROM uploads WHERE id='${uploadId}';`) === `${uploadId}.png`);
 check('Unbound screenshot hidden from colleague', (await call(`/api/uploads/${uploadId}`, { user: ravi })).status === 404);
 check('Cross-owner screenshot attach denied', (await submit(ravi, report({ upload_id: uploadId }))).status === 403);
 check('Nonimage screenshot denied', (await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(Buffer.from('<script>alert(1)</script>')) })).status === 400);
 check('Truncated screenshot denied', (await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(image.subarray(0, Math.floor(image.length / 2))) })).status === 400);
 check('MIME mismatch denied', (await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(image, 'image/jpeg') })).status === 400);
 check('Oversized screenshot denied', (await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(Buffer.alloc(5 * 1024 * 1024 + 1)) })).status === 413);
 check('Outsider upload denied', (await call('/api/uploads', { user: outsider, method: 'POST', form: imageForm(image) })).status === 403);
 browser ||= await chromium.launch({ channel: 'chrome', headless: true });
 const rasterPage = await browser.newPage({ viewport: { width: 4100, height: 200 } });
 const tooWide = await rasterPage.screenshot();
 check('Decoded dimension limit enforced', (await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(tooWide) })).status === 400);
 await rasterPage.setViewportSize({ width: 240, height: 240 });
 const jpeg = await rasterPage.screenshot({ type: 'jpeg' });
 const jpegUpload = await call('/api/uploads', { user: asha, method: 'POST', form: imageForm(jpeg, 'image/jpeg') });
 check('JPEG decoder path works', jpegUpload.status === 201 && jpegUpload.body.mime === 'image/jpeg');
 await rasterPage.close();
 const key = crypto.randomUUID(), payload = report({ upload_id: uploadId });
 const created = await submit(asha, payload, key); check('Report creates queued unconfirmed ticket', created.status === 201 && created.body.ticket.state === 'QUEUED' && created.body.ticket.confirmed === 'f');
 const id = created.body.ticket.id;
 check('Priority rule persisted', created.body.ticket.priority === '2' && created.body.ticket.rule_id === 'provisional-v1-unconfirmed');
 check('Authenticated reporter used', created.body.ticket.employee_id === asha.id);
 const replay = await submit(asha, payload, key); check('Exact replay returns same ticket', replay.status === 200 && replay.body.replayed && replay.body.ticket.id === id);
 check('Changed replay rejected', (await submit(asha, { ...payload, title: 'changed' }, key)).status === 409);
 check('Screenshot cannot bind twice', (await submit(asha, payload)).status === 403);
 check('Colleague reads attached evidence', (await call(`/api/uploads/${uploadId}`, { user: ravi })).status === 200);
 check('Outsider cannot read evidence', (await call(`/api/uploads/${uploadId}`, { user: outsider })).status === 404);
 check('Outsider cannot read ticket', (await call(`/api/tickets/${id}`, { user: outsider })).status === 403);
 check('Exactly one linked investigation', sql(`SELECT count(*) FROM investigations i JOIN tickets t ON t.investigation_id=i.id WHERE t.id=${id};`) === '1');
 check('Exactly one submission event', sql(`SELECT count(*) FROM events WHERE ticket_id=${id};`) === '1');
 check('Exactly one acknowledgement', sql(`SELECT count(*) FROM notifications WHERE ticket_id=${id};`) === '1');
 check('No failed-validation request rows', sql('SELECT count(*) FROM requests;') === '1');
 const cosmetic = await submit(ravi, report({ title: 'Buttons overlap', reported_impact: 'cosmetic' }));
 const high = await submit(asha, report({ title: 'Reported loss needs evidence', reported_impact: 'data_loss' }));
 const feature = await submit(ravi, report({ title: 'Add completed filter', kind: 'feature', reproduction: '' }));
 check('Cosmetic rule is P3', cosmetic.body.ticket.priority === '3');
 check('Unconfirmed data loss cannot become P0', high.body.ticket.priority === '2');
 check('Feature proposal starts P3 without authorization', feature.body.ticket.priority === '3' && feature.body.ticket.state === 'QUEUED');
 const queue = (await call('/api/tickets', { user: asha })).body.tickets;
 check('Stable priority/time/ID ordering', queue.map(t => t.id).join(',') === [id, high.body.ticket.id, cosmetic.body.ticket.id, feature.body.ticket.id].join(','));
 const distinct = await Promise.all(['cosmetic', 'local_functional', 'core_workflow'].map((impact, index) => submit(asha, report({ title: `Concurrent distinct ${index}`, reported_impact: impact }))));
 check('Three distinct concurrent submissions persist', distinct.every(r => r.status === 201) && new Set(distinct.map(r => r.body.ticket.id)).size === 3);
 const ordered = (await call('/api/tickets', { user: asha })).body.tickets;
 const expectedOrder = [...ordered].sort((a, b) => Number(a.priority) - Number(b.priority) || a.created_at.localeCompare(b.created_at) || Number(a.id) - Number(b.id));
 check('Concurrent queue ordered by trusted policy', ordered.map(t => t.id).join(',') === expectedOrder.map(t => t.id).join(','));
 const secondServer = await start(8096);
 const concurrentKey = crypto.randomUUID();
 const duplicates = await Promise.all(Array.from({ length: 6 }, (_, i) => submit(asha, report({ title: 'Concurrent duplicate' }), concurrentKey, i % 2 ? 8096 : 8095)));
 check('Concurrent replay across two API processes creates once', duplicates.filter(r => r.status === 201).length === 1 && new Set(duplicates.map(r => r.body.ticket?.id)).size === 1 && duplicates.every(r => r.status === 200 || r.status === 201));
 check('Concurrent effect unique in database', sql("SELECT count(*) FROM requests WHERE title='Concurrent duplicate';") === '1');
 await stop(secondServer);
 check('Colleague cannot withdraw requester ticket', (await call(`/api/tickets/${id}/cancel`, { user: ravi, method: 'POST', data: {} })).status === 403);
 check('Requester withdrawal succeeds', (await call(`/api/tickets/${id}/cancel`, { user: asha, method: 'POST', data: {} })).status === 200);
 check('Repeated withdrawal is idempotent', (await call(`/api/tickets/${id}/cancel`, { user: asha, method: 'POST', data: {} })).status === 200 && sql(`SELECT count(*) FROM events WHERE ticket_id=${id} AND type='cancelled';`) === '1');
 check('Withdrawn ticket leaves queue', !(await call('/api/tickets', { user: asha })).body.tickets.some(t => t.id === id));
 check('Withdrawn ticket retained in history', (await call('/api/tickets?view=history', { user: asha })).body.tickets.some(t => t.id === id));
 check('History retains evidence', (await call(`/api/uploads/${uploadId}`, { user: ravi })).status === 200);
 const notifications = (await call('/api/notifications', { user: asha })).body.notifications;
 const note = notifications.find(n => n.ticket_id === id);
 check('Notifications private to employee', !(await call('/api/notifications', { user: ravi })).body.notifications.some(n => n.ticket_id === id));
 check('Other user cannot mark notification read', (await call(`/api/notifications/${note.id}/read`, { user: ravi, method: 'POST', data: {} })).status === 404);
 check('Owner marks read', (await call(`/api/notifications/${note.id}/read`, { user: asha, method: 'POST', data: {} })).status === 200);
 check('Read receipt persisted', (await call('/api/notifications', { user: asha })).body.notifications.find(n => n.id === note.id).read_at !== null);
 let ddlDenied = false; try { sql('CREATE TABLE forbidden_test(id int);', 'app'); } catch { ddlDenied = true; } check('Runtime role cannot create tables', ddlDenied);
 let tempDenied = false; try { sql('CREATE TEMP TABLE forbidden_temp(id int);', 'app'); } catch { tempDenied = true; } check('Runtime role cannot create temporary tables', tempDenied);
 check('Runtime role has no administrative capabilities', sql("SELECT NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication) FROM pg_roles WHERE rolname='devdesk_app';") === 't');
 let auditDenied = false; try { sql(`UPDATE events SET message='tampered' WHERE ticket_id=${id};`, 'app'); } catch { auditDenied = true; } check('Runtime role cannot rewrite audit messages', auditDenied);
 let deletionDenied = false; try { sql(`DELETE FROM tickets WHERE id=${id};`, 'app'); } catch { deletionDenied = true; } check('Runtime role cannot delete tickets', deletionDenied);
 check('Passwords stored as salted hashes', sql('SELECT bool_and(length(password_hash)=64 AND length(salt)=32) FROM employees;') === 't');
 check('Session token stored as SHA256 digest', sql(`SELECT count(*) FROM sessions WHERE token_hash='${crypto.createHash('sha256').update(asha.cookie.split('=')[1]).digest('hex')}';`) === '1');
 await stop(server); server = await start();
 check('Restart preserves session and history', (await call('/api/tickets?view=history', { user: asha })).body.tickets.some(t => t.id === id));
 check('Restart preserves notification read state', (await call('/api/notifications', { user: asha })).body.notifications.find(n => n.id === note.id).read_at !== null);
 check('Restart preserves image bytes', (await call(`/api/uploads/${uploadId}`, { user: asha })).body.length === image.length);
 sql(`UPDATE sessions SET expires_at=now()-interval '1 second' WHERE employee_id=${outsider.id};`);
 check('Expired session denied', (await call('/api/me', { user: outsider })).status === 401);
 check('Logout revokes server session', (await call('/api/logout', { user: ravi, method: 'POST', data: {} })).status === 200 && (await call('/api/me', { user: ravi })).status === 401);
 const badLogins = []; for (let i = 0; i < 6; ++i) badLogins.push((await call('/api/login', { method: 'POST', data: { username: 'noah', password: 'wrong' } })).status);
 check('Failed login attempts bounded', badLogins.slice(0, 5).every(s => s === 401) && badLogins[5] === 429);
 // Real browser checks. No credentials or cookies are saved in the evidence report.
 browser ||= await chromium.launch({ channel: 'chrome', headless: true });
 const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
 const browserErrors = []; page.on('pageerror', error => browserErrors.push(error.message));
 await page.goto(base); await page.getByRole('textbox', { name: 'Username', exact: true }).fill('asha'); await page.getByLabel('Password', { exact: true }).fill(accounts.find(a => a.username === 'asha').password);
 await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByRole('heading', { name: 'Your maintenance desk.' }).waitFor();
 check('Browser login and queue rendered', await page.getByRole('heading', { name: 'Active queue', exact: true }).isVisible());
 await page.getByRole('button', { name: /New report/ }).click(); await page.getByLabel('Title', { exact: true }).fill('<img src=x onerror=alert(1)>');
 await page.getByLabel('Description', { exact: true }).fill('Mobile task buttons overlap. Synthetic screenshot attached.'); await page.getByLabel('Steps to reproduce').fill('Open the frontend fixture at 390 × 844.');
 await page.getByLabel('Playground URL').fill('http://127.0.0.1:8081/');
 await page.getByLabel('Screenshot (optional)', { exact: true }).setInputFiles({ name: 'mobile.png', mimeType: 'image/png', buffer: image });
 await page.getByRole('button', { name: 'Submit report', exact: true }).click(); await page.getByText(/Report #[0-9]+ received/).waitFor();
 await page.locator('#detail img').waitFor();
 check('Browser report/screenshot submission', await page.locator('#detail img').isVisible());
 check('Untrusted title rendered as text', await page.locator('#detail h2').textContent() === '<img src=x onerror=alert(1)>' && await page.locator('#detail h2 img').count() === 0);
 await page.screenshot({ path: path.join(run, 'workbench-desktop.png'), fullPage: true });
 await page.reload(); await page.getByRole('heading', { name: 'Your maintenance desk.' }).waitFor();
 await page.getByRole('heading', { name: '<img src=x onerror=alert(1)>', exact: true }).waitFor();
 check('Browser refresh preserves report', await page.getByRole('heading', { name: '<img src=x onerror=alert(1)>', exact: true }).isVisible());
 await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(run, 'workbench-mobile.png'), fullPage: true });
 check('Mobile viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
 await page.getByRole('button', { name: /History/ }).click(); await page.getByRole('heading', { name: payload.title, exact: true }).waitFor(); check('Browser history shows withdrawn ticket', await page.getByRole('heading', { name: payload.title, exact: true }).isVisible());
 await page.getByRole('button', { name: /Notifications/ }).click(); await page.getByRole('heading', { name: 'Report received. Awaiting independent investigation.', exact: true }).first().waitFor(); check('Browser notifications show real acknowledgement', await page.getByRole('heading', { name: 'Report received. Awaiting independent investigation.', exact: true }).count() > 0);
 check('Browser has no script errors', browserErrors.length === 0, browserErrors.join('; '));
 // Rollback check: trusted test schema trigger rejects notification; no partial request/ticket/event survives.
 sql("CREATE FUNCTION reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rejection'; END $$; CREATE TRIGGER reject_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notice();");
 const before = sql('SELECT (SELECT count(*) FROM requests)||\',\'||(SELECT count(*) FROM investigations)||\',\'||(SELECT count(*) FROM tickets)||\',\'||(SELECT count(*) FROM events);');
 const failure = await submit(asha, report({ title: 'Atomic rollback demonstration' }));
 check('Forced transaction failure reports failure', failure.status === 500);
 check('Failed acknowledgement rolls back entire submission', sql('SELECT (SELECT count(*) FROM requests)||\',\'||(SELECT count(*) FROM investigations)||\',\'||(SELECT count(*) FROM tickets)||\',\'||(SELECT count(*) FROM events);') === before);
 sql('DROP TRIGGER reject_notice ON notifications; DROP FUNCTION reject_notice();');
} catch (error) {
 checks.push({ name: 'Run completion', result: 'FAIL', detail: error.message });
 process.exitCode = 1;
} finally {
 if (browser) await browser.close();
 for (const child of processes) await stop(child);
 const result = { phase: 2, build, finished_at: new Date().toISOString(), duration_ms: Date.now() - started, schema: config?.schema, checks, totals: { pass: checks.filter(c => c.result === 'PASS').length, fail: checks.filter(c => c.result === 'FAIL').length }, model_calls: 0, limitations: ['Local Windows demo; no worker, voting, source edits or completion.', 'Test secrets and accounts remain in ignored local files; report contains no credentials.'] };
 await fs.writeFile(path.join(run, 'report.json'), JSON.stringify(result, null, 2));
 await fs.writeFile(path.join(root, 'var', 'evidence', 'phase2-latest.json'), JSON.stringify({ report: path.relative(root, path.join(run, 'report.json')) }, null, 2));
 console.log(JSON.stringify({ report: path.relative(root, path.join(run, 'report.json')), ...result.totals, duration_ms: result.duration_ms }));
}
