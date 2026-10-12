// Trusted, fixed read-only helper. Model input never supplies a URL, command or output path.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {checkControl} from './control-contract.mjs';
const job = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const { chromium } = createRequire(path.join(job.workspace_root, 'tools', 'package.json'))('playwright');
let browser;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const failure = message => { throw new Error(message); };
const statusValues = ['', 'todo', 'in_progress', 'done'];
const sourceRoot = await fs.realpath(job.source_root);
function allowedUrl(raw) {
 const url = new URL(raw);
 if (url.origin !== job.origin || url.username || url.password || url.hash) return false;
 if (url.pathname === '/api/tasks') return [...url.searchParams].length <= 1 && [...url.searchParams].every(([k, v]) => k === 'status' && statusValues.includes(v));
 return ['/', '/index.html', '/app.js', '/styles.css', '/api/health'].includes(url.pathname) && !url.search;
}
async function get(url) {
 if (!allowedUrl(url)) failure('URL policy denied');
 let response;
 for(let attempt=0;attempt<3;attempt++) {
  await checkControl(job);
  try { response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)}); }
  catch(error) { if(attempt===2)throw error; }
  if(response && ![502,503,504].includes(response.status))break;
  if(response)await response.body?.cancel();
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
 }
 if (!response.ok) failure('Controlled app request failed');
 const chunks = []; let size = 0;
 for await (const chunk of response.body) { size += chunk.length; if (size > 100000) failure('App response exceeds limit'); chunks.push(chunk); }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function identity() {
 const git = args => execFileSync(job.git_exe, ['-c', `safe.directory=${sourceRoot}`, '-c', 'core.fsmonitor=false', '-C', sourceRoot, ...args], { encoding: 'utf8', timeout: 4000, windowsHide: true, maxBuffer: 100000 }).trim();
 const head = git(['rev-parse', 'HEAD']);
 if (git(['status', '--porcelain'])) failure('Source checkout has uncommitted changes');
 const built = JSON.parse((await fs.readFile(path.join(sourceRoot, 'build', 'build-info.json'), 'utf8')).replace(/^\uFEFF/, ''));
 const sourceFiles = [];
 async function collect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
   const filename = path.join(directory, entry.name);
   if (entry.isSymbolicLink()) failure('Source identity contains a link');
   if (entry.isDirectory()) await collect(filename); else if (entry.isFile()) sourceFiles.push(filename);
  }
 }
 for (const folder of ['src', 'static', 'third_party']) await collect(path.join(sourceRoot, folder));
 sourceFiles.sort((a, b) => a.localeCompare(b, 'en-US', { sensitivity: 'base' }));
 const fingerprint = [];
 for (const filename of sourceFiles) fingerprint.push(`\\${path.relative(sourceRoot, filename)}:${digest(await fs.readFile(filename)).toUpperCase()}`);
 if (digest(Buffer.from(fingerprint.join('\n'))) !== built.build) failure('Current source bytes differ from the app build snapshot');
 const live = await get(`${job.origin}/api/health`);
 if (head !== built.commit || live.commit !== head || live.build !== built.build) failure('Live app, source and built identity do not match');
 if (job.base_commit && (head !== job.base_commit || live.build !== job.app_build)) failure('Baseline changed during investigation');
 return { commit: head, build: live.build, origin: job.origin };
}
async function safePath(relative) {
 if (!/^(src|static)\/[A-Za-z0-9_./-]+\.(cpp|hpp|js|html|css)$/.test(relative) || relative.split('/').some(part => part === '..' || part === '.')) failure('Source path denied');
 const candidate = path.join(sourceRoot, relative);
 try { execFileSync(job.git_exe, ['-c', `safe.directory=${sourceRoot}`, '-C', sourceRoot, 'ls-files', '--error-unmatch', '--', relative], { timeout: 4000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64000 }); }
 catch { failure('Source file is not tracked in the bound checkout'); }
 let cursor = sourceRoot;
 for (const segment of relative.split('/')) { cursor = path.join(cursor, segment); if ((await fs.lstat(cursor)).isSymbolicLink()) failure('Source link denied'); }
 const real = await fs.realpath(candidate);
 if (!real.toLowerCase().startsWith(`${sourceRoot}${path.sep}`.toLowerCase())) failure('Source containment denied');
 const stat = await fs.stat(real); if (!stat.isFile() || stat.size > 64000) failure('Source file exceeds limit');
 return real;
}
async function listFiles() {
 const files = [];
 async function walk(relative) {
  const entries = await fs.readdir(path.join(sourceRoot, relative), { withFileTypes: true });
  for (const entry of entries) {
   const rel = `${relative}/${entry.name}`;
   if (entry.isSymbolicLink()) continue;
   if (entry.isDirectory()) { if (rel.split('/').length < 5) await walk(rel); }
   else if (/\.(cpp|hpp|js|html|css)$/.test(rel)) { await safePath(rel); files.push(rel); if (files.length > 50) failure('File listing exceeds limit'); }
  }
 }
 await walk('src'); await walk('static'); return files.sort();
}
function validTasks(data) {
 if (!Array.isArray(data.tasks) || data.tasks.length > 100) failure('Task list cannot be safely evaluated');
 for (const t of data.tasks) if (!Number.isSafeInteger(t.id) || !['todo', 'in_progress', 'done'].includes(t.status) || typeof t.title !== 'string' || t.title.length > 120) failure('Unexpected task schema');
 return data.tasks;
}
try {
 await checkControl(job);
 if (!/^http:\/\/127\.0\.0\.1:808[0-3]$/.test(job.origin)) failure('Origin denied');
 const action = job.action;
 if (!statusValues.includes(action.status)) failure('Status denied');
 if (action.tool === 'source_read' && (!Number.isInteger(action.start_line) || action.start_line < 1 || action.start_line > 10000 || !Number.isInteger(action.limit) || action.limit < 1 || action.limit > 160)) failure('Line range denied');
 if (action.tool === 'source_search' && (typeof action.query !== 'string' || !action.query.length || action.query.length > 100)) failure('Search limit denied');
 const before = await identity();
 let result = { identity: before, assertions: [] };
 if (action.tool === 'identity') { /* worker initialization; not a model tool */ }
 else if (action.tool === 'source_list') result.files = await listFiles();
 else if (action.tool === 'source_read') {
  const filename = await safePath(action.path); const bytes = await fs.readFile(filename); const lines = bytes.toString('utf8').split(/\r?\n/);
  result = { ...result, path: action.path, sha256: digest(bytes), start_line: action.start_line, total_lines: lines.length, lines: lines.slice(action.start_line - 1, action.start_line - 1 + action.limit) };
 } else if (action.tool === 'source_search') {
  const matches = []; for (const file of await listFiles()) {
   const lines = (await fs.readFile(await safePath(file), 'utf8')).split(/\r?\n/);
   for (let i = 0; i < lines.length; ++i) if (lines[i].includes(action.query) && matches.length < 80) matches.push({ path: file, line: i + 1, text: lines[i].slice(0, 500) });
  } result.matches = matches;
 } else if (action.tool === 'api_observe') {
  const all = validTasks(await get(`${job.origin}/api/tasks`));
  const actual = validTasks(await get(`${job.origin}/api/tasks${action.status ? `?status=${action.status}` : ''}`));
  const after = validTasks(await get(`${job.origin}/api/tasks`));
  if (JSON.stringify(all) !== JSON.stringify(after)) failure('App data changed while observing filter');
  const expected = all.filter(t => !action.status || t.status === action.status);
  const ids = tasks => tasks.map(t => t.id).sort((a, b) => a - b);
  result = { ...result, status: action.status, all, actual, expected_ids: ids(expected), actual_ids: ids(actual), assertions: [{ name: 'status_filter_exact', result: JSON.stringify(ids(expected)) === JSON.stringify(ids(actual)) ? 'PASS' : 'FAIL' }] };
 } else if (action.tool === 'browser_observe') {
  if (!allowedUrl(job.page_url)) failure('Reported page is outside supported navigation scope');
  browser = await chromium.launch({ executablePath: job.chrome_exe, headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'] });
  const context = await browser.newContext({ viewport: { width: job.width, height: job.height }, serviceWorkers: 'block' });
  const denied = [];
  await context.route('**/*', async route => {
   const req = route.request();
   if (req.method() !== 'GET' || !allowedUrl(req.url())) { denied.push({ method: req.method(), reason: 'request policy denied' }); await route.abort(); }
   else {
    const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
    if (response.status() >= 300 && response.status() < 400) { denied.push({ reason: 'redirect denied' }); await route.abort(); }
    else { const bytes = await response.body(); if (bytes.length > 100000) { denied.push({ reason: 'resource limit' }); await route.abort(); } else await route.fulfill({ response, body: bytes }); }
   }
  });
  const page = await context.newPage(); const errors = []; page.on('pageerror', () => errors.push('Page script error')); page.on('dialog', dialog => dialog.dismiss());
  await page.goto(job.page_url, { timeout: 10000, waitUntil: 'networkidle' });
  if (action.status) { const filter = page.locator(`[data-filter="${action.status}"]`); if (await filter.count()) { await filter.click(); await page.waitForFunction(() => document.querySelector('#task-list')?.getAttribute('aria-busy') === 'false'); } }
  const facts = await page.evaluate(() => {
   const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
   const cards = [...document.querySelectorAll('.task-card')].map(card => {
    const advance = card.querySelector('.advance'), remove = card.querySelector('.remove');
    if (!advance || !remove) return { id: card.dataset.taskId, missing_controls: true };
    const a = rect(advance), b = rect(remove);
    const area = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const visible = [advance, remove].every(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; });
    return { id: card.dataset.taskId, advance: a, remove: b, overlap_area: area, visible, disabled: advance.disabled || remove.disabled };
   });
   return { cards, filters: [...document.querySelectorAll('[data-filter]')].map(e => ({ status: e.dataset.filter, text: e.textContent })), document_height: document.documentElement.scrollHeight, document_width: document.documentElement.scrollWidth };
  });
  const fullPage = facts.document_height <= 4096 && facts.document_height * job.width <= 16000000;
  await page.screenshot({ path: job.screenshot_path, fullPage });
  const geometry = facts.cards.length && facts.cards.every(c => !c.missing_controls && c.visible) ? facts.cards.some(c => c.overlap_area > 0) ? 'FAIL' : 'PASS' : 'UNKNOWN';
  result = { ...result, viewport: { width: job.width, height: job.height }, status: action.status, facts, screenshot: { full_page: fullPage }, denied_requests: denied, script_errors: errors, assertions: [{ name: 'action_buttons_separate', result: geometry }, { name: 'completed_filter_present', result: facts.filters.some(f => f.status === 'done') ? 'PASS' : 'FAIL' }] };
 } else failure('Tool denied');
 await checkControl(job);
 const after = await identity(); if (JSON.stringify(before) !== JSON.stringify(after)) failure('App identity changed during observation');
 if (JSON.stringify(result).length > 40000) failure('Observation exceeds limit');
 await fs.writeFile(process.argv[3], JSON.stringify({ ok: true, result }));
} catch (error) {
 console.error(error.message); // Local helper diagnostics contain no model/runtime credential.
 await fs.writeFile(process.argv[3], JSON.stringify({ ok: false, error: error.message.slice(0, 180) }));
 process.exitCode = 1;
} finally { if (browser) await browser.close(); }
