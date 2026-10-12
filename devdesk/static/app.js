'use strict';
const $ = selector => document.querySelector(selector);
let me = null;
let view = 'queue';
// Keep the operation key and upload across ambiguous network failures.
let submission = null;
const stateLabels = { AWAITING_FEATURE_VOTE:'Awaiting feature votes', INVALID:'Feature consensus rejected', QUEUED: 'Awaiting investigation', INVESTIGATING: 'Investigating · read-only', INVESTIGATED_READ_ONLY: 'Investigation recorded · no repair', NEEDS_INFORMATION: 'Needs information', CANCELLED: 'Withdrawn', AWAITING_BUG_APPROVAL: 'Review source-change scope', READY: 'Approved · awaiting isolated repair', IMPLEMENTING: 'Repairing isolated checkout', VERIFYING: 'Checking candidate', CANDIDATE_READY: 'Candidate ready · not integrated', REPAIR_BLOCKED: 'Repair blocked · review evidence' };
function notice(text, error = false) { $('#message').textContent = text; $('#message').className = error ? 'error' : ''; }
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function api(path, { method = 'GET', data, form, key } = {}) {
 const headers = {};
 if (method !== 'GET' && me) headers['X-CSRF-Token'] = me.csrf;
 if (data !== undefined) headers['Content-Type'] = 'application/json';
 if (key) headers['Idempotency-Key'] = key;
 const response = await fetch(path, { method, headers, body: form || (data === undefined ? undefined : JSON.stringify(data)), credentials: 'same-origin' });
 const result = await response.json();
 if (!response.ok) { if (response.status === 401 && path !== '/api/login') showLogin(); throw new Error(result.error || `Request failed (${response.status})`); }
 return result;
}
function showLogin() { me = null; $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; $('#identity').textContent = ''; }
async function session() {
 try { me = await api('/api/me'); $('#identity').textContent = me.name; $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  $('#project-select').replaceChildren(...me.projects.map(p => { const option = node('option', p.name); option.value = p.id; return option; }));
  $('#submit-report').disabled = !me.projects.length;
  await refresh();
 } catch (error) { showLogin(); if (error.message !== 'Please sign in') notice(error.message, true); }
}
async function detail(id) {
 const result = await api(`/api/tickets/${id}`); const t = result.ticket; const el = $('#detail'); el.replaceChildren(); el.hidden = false;
 el.append(node('p', `REQUEST #${t.id} · ${t.state}`, 'eyebrow'), node('h2', t.title), node('p', t.description));
 const facts = node('dl');
 for (const [label, value] of [['Reporter', t.reporter], ['Priority', `P${t.priority} · provisional`], ['Policy rule', t.rule_id], ['Investigation', `${t.investigation_state} · ${t.kind==='feature'?'feature assessment':t.confirmed === 't' ? 'reproduced by observations' : 'unconfirmed'}`], ['Viewport', `${t.viewport_width} × ${t.viewport_height}`], ['Playground URL', t.page_url]]) facts.append(node('dt', label), node('dd', value));
 el.append(facts, node('p', t.priority_reason, 'muted'), node('h3', 'Reproduction steps'), node('p', t.reproduction || 'Feature proposal; investigation pending.'));
 if (t.upload_id) { const image = node('img'); image.src = `/api/uploads/${t.upload_id}`; image.alt = 'Original report screenshot; unverified evidence'; el.append(node('h3', 'Submitted evidence'), image); }
 for (const run of result.runs || []) {
  el.append(node('h3', run.mode === 'scripted_test' ? 'SCRIPTED TEST investigation · no live model' : 'Live model investigation'), node('p', `${run.state} · ${run.model}\n${run.summary || 'Read-only observations in progress.'}`));
  el.append(node('p', `Run ${run.id}\nBaseline commit ${run.base_commit || 'not established'}\nApp build ${run.app_build || 'not established'}\n${run.model_calls} model-call attempts · ${run.input_tokens} input / ${run.output_tokens} output tokens · observed-usage estimate $${Number(run.estimated_usd).toFixed(6)}${run.usage_complete === 'f' ? '\nUsage receipt is incomplete; billed amount is unknown.' : ''}`, 'muted'));
  for (const observation of (result.observations || []).filter(o => o.run_id === run.id)) {
   const data = JSON.parse(observation.result);
   const block = node('details', undefined, 'observation');
   block.append(node('summary', `${observation.tool} · ${observation.id}`));
   for (const assertion of data.assertions || []) block.append(node('p', `${assertion.result} · ${assertion.name}`, 'badge'));
   block.append(node('pre', JSON.stringify(data, null, 2)));
   if (observation.upload_id) { const image = node('img'); image.src = `/api/uploads/${observation.upload_id}`; image.alt = 'Read-only browser baseline evidence'; block.append(image); }
   el.append(block);
  }
  const trace = node('details'); trace.append(node('summary', 'Model action trace'));
  for (const decision of (result.decisions || []).filter(d => d.run_id === run.id)) trace.append(node('pre', `Step ${decision.step} · ${decision.state}\n${decision.action || 'No durable response; the call may have been interrupted.'}`));
  el.append(trace);
 }
 if (t.employee_id === me.id && t.state === 'INVESTIGATED_READ_ONLY' && ((t.confirmed === 't' && t.kind === 'bug' && /^http:\/\/127\.0\.0\.1:808[12](\/|$)/.test(t.page_url)) || (t.kind==='feature'&&/^http:\/\/127\.0\.0\.1:8083(\/|$)/.test(t.page_url)))) {
  const button=node('button','Prepare repair scope');button.onclick=()=>safely(async()=>{await api(`/api/tickets/${id}/proposal`,{method:'POST',data:{}});await detail(id);});el.append(button);
 }
 for(const proposal of result.proposals || []) {
  el.append(node('h3',`Repair scope · revision ${proposal.revision} · ${proposal.state}`),node('p',proposal.risk),node('p',`Base commit ${proposal.base_commit}\nAllowed files: ${JSON.parse(proposal.files).join(', ')}\nExpires: ${proposal.expires_at}`));
  for(const criterion of JSON.parse(proposal.criteria))el.append(node('p',criterion));
  if(t.employee_id===me.id && proposal.state==='PROPOSED' && ['AWAITING_BUG_APPROVAL','AWAITING_FEATURE_VOTE'].includes(t.state)) {
   const button=node('button','Approve this source-change scope');button.onclick=()=>safely(async()=>{const response=await api(`/api/proposals/${proposal.id}/approve`,{method:'POST',data:{scope_hash:proposal.scope_hash}});notice(response.state==='READY'?'Scope approved. Isolated implementation may now begin.':'Scope approved. Waiting for feature consensus.');await detail(id);});el.append(button);
  }
 }
 for(const poll of result.polls||[]){
  const yes=poll.votes.filter(v=>v.choice==='YES').length;el.append(node('h3',`Feature vote · ${poll.state}`),node('p',`${yes} yes votes; ${poll.threshold} required from the fixed ${poll.roster_size}-member roster. Deadline: ${poll.deadline}`),node('p','Your vote applies to the source scope and criteria shown above. No response does not count as approval.'));
  el.append(node('p',poll.members.map(m=>`${m.name}: ${poll.votes.find(v=>v.employee_id===m.employee_id)?.choice||'No vote'}`).join(' · ')));
  if(poll.state==='OPEN'&&poll.members.some(m=>m.employee_id===me.id)&&!poll.votes.some(v=>v.employee_id===me.id)&&t.cancel_requested!=='t'){for(const choice of ['YES','NO']){const button=node('button',`Vote ${choice==='YES'?'yes':'no'} on this feature scope`);button.onclick=()=>safely(async()=>{await api(`/api/feature-polls/${poll.id}/vote`,{method:'POST',data:{goal_hash:poll.goal_hash,choice}});await detail(id);await refresh();});el.append(button);}}
 }
 for(const repair of result.repairs || []) {
  el.append(node('h3',`${repair.mode==='scripted_test'?'SCRIPTED TEST':'Live'} repair · ${repair.state}`),node('p',repair.summary||'Scoped repair in progress.'),node('p',`Candidate ${repair.candidate_commit||'not produced'}\n${repair.model_calls} model calls · estimated $${Number(repair.estimated_usd).toFixed(6)}${repair.usage_complete==='f'?' · incomplete usage receipt':''}`));
  if(repair.diff)el.append(node('pre',repair.diff));
  const trace=node('details');trace.append(node('summary','Repair actions and check evidence'));
  for(const step of (result.repair_steps || []).filter(s=>s.run_id===repair.id))trace.append(node('pre',`Step ${step.step} · ${step.state}\n${step.action||''}\n${step.result||''}`));el.append(trace);
  if(repair.state==='CANDIDATE_READY'){
   el.append(node('p','Review this candidate commit, diff and check evidence. Final acceptance permits guarded integration.'));
   for(const width of [390,1280]){const image=node('img');image.src=`/api/repairs/${repair.id}/artifacts/${width}.png`;image.alt=`Isolated candidate checked at ${width}px`;el.append(image);}
   if(t.employee_id===me.id&&(t.state==='CANDIDATE_READY'||t.state==='AWAITING_ACCEPTANCE')){const button=node('button','Prepare candidate acceptance review');button.onclick=()=>safely(async()=>{await api(`/api/repairs/${repair.id}/review`,{method:'POST',data:{}});await detail(id);});el.append(button);}
  }
 }
 for(const review of result.reviews||[]){el.append(node('h3',`Candidate review · ${review.state}`),node('p',`Exact commit ${review.candidate_commit}\nEvidence step ${review.evidence_step}\nExpires ${review.expires_at}`));
  if(t.employee_id===me.id&&review.state==='PENDING'&&t.state==='AWAITING_ACCEPTANCE'){for(const choice of ['ACCEPTED','REJECTED']){const button=node('button',choice==='ACCEPTED'?'Accept candidate and authorize integration':'Reject candidate');button.onclick=()=>safely(async()=>{await api(`/api/candidate-reviews/${review.id}/decision`,{method:'POST',data:{review_hash:review.review_hash,decision:choice}});await detail(id);await refresh();});el.append(button);}}
 }
 for(const integration of result.integrations||[]){el.append(node('h3',`Integration · ${integration.state}`),node('p',integration.summary||'Serialized integration in progress'),node('pre',integration.result||''));}
 el.append(node('h3', 'Recorded events'));
 for (const event of result.events) el.append(node('p', `${event.created_at}\n${event.message}`, 'event'));
 if (t.employee_id === me.id && !['INTEGRATING','COMPLETED','CANCELLED','INVALID'].includes(t.state) && t.cancel_requested !== 't') { const button = node('button', 'Cancel this report', 'danger'); button.onclick = () => safely(async () => { const response=await api(`/api/tickets/${id}/cancel`, { method: 'POST', data: {} }); notice(response.state==='CANCEL_REQUESTED'?'Cancellation requested. The active worker will stop at its next safe boundary.':'Report cancelled; evidence retained.'); await detail(id); await refresh(); }); el.append(button); }
 if(t.cancel_requested==='t'&&t.state!=='CANCELLED')el.append(node('p','Cancellation requested; waiting for the active worker to stop.'));
 if(t.employee_id===me.id&&t.cancel_requested!=='t'&&['NEEDS_INFORMATION','INVESTIGATED_READ_ONLY','REPAIR_BLOCKED'].includes(t.state)){const button=node('button','Request a fresh investigation');button.onclick=()=>safely(async()=>{await api(`/api/tickets/${id}/retry-investigation`,{method:'POST',data:{}});await detail(id);await refresh();});el.append(button);}
 el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function cards(tickets) {
 const root = $('#records'); root.replaceChildren();
 if (!tickets.length) { root.append(node('p', view === 'history' ? 'No completed, rejected or withdrawn reports yet.' : 'The queue is clear. Submit a report to get started.', 'empty')); return; }
 for (const ticket of tickets) {
  const row = node('article', undefined, 'record'); const content = node('div');
  content.append(node('span', `P${ticket.priority} provisional`, 'badge priority'), node('span', ticket.kind === 'bug' ? 'BUG' : 'FEATURE', 'badge'), node('h3', ticket.title), node('p', `#${ticket.id} · ${ticket.reporter} · ${stateLabels[ticket.state] || ticket.state}`, 'muted'));
  const button = node('button', 'View report'); button.onclick = () => safely(() => detail(ticket.id)); row.append(content, button); root.append(row);
 }
}
async function refresh() {
 if (!me) return;
 const notifications = (await api('/api/notifications')).notifications;
 $('#unread-count').textContent = notifications.filter(n => !n.read_at).length;
 if (!me.projects.length) { $('#records').replaceChildren(node('p', 'Your account has no access to Team Tasks.', 'empty')); $('#queue-count').textContent = '0'; return; }
 const queue = (await api('/api/tickets?view=queue')).tickets; $('#queue-count').textContent = queue.length;
 if (view === 'report') return;
 $('#detail').hidden = true;
 if (view === 'notifications') {
  $('#records').replaceChildren(); if (!notifications.length) $('#records').append(node('p', 'No notifications yet.', 'empty'));
  for (const item of notifications) { const row = node('article', undefined, 'record'); const content = node('div'); content.append(node('h3', item.message), node('p', `Request #${item.ticket_id} · ${item.created_at}`, 'muted')); row.append(content);
   if (!item.read_at) { const button = node('button', 'Mark read'); button.onclick = () => safely(async () => { await api(`/api/notifications/${item.id}/read`, { method: 'POST', data: {} }); await refresh(); }); row.append(button); } $('#records').append(row);
  }
 } else cards(view === 'queue' ? queue : (await api('/api/tickets?view=history')).tickets);
}
async function changeView(next) { view = next; $('#report-panel').hidden = next !== 'report'; $('#list-panel').hidden = next === 'report'; $('#detail').hidden = true; $('#view-title').textContent = { queue: 'Active queue', history: 'History', notifications: 'Notifications' }[next] || ''; $('#list-caption').textContent = next === 'queue' ? 'Priority → submission time → ID' : ''; document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('selected', button.dataset.view === next)); await refresh(); }
async function safely(action) { try { await action(); } catch (error) { notice(error.message, true); } }
$('#login-form').addEventListener('submit', event => { event.preventDefault(); safely(async () => { const form = new FormData(event.target); const button = event.target.querySelector('button'); button.disabled = true; try { await api('/api/login', { method: 'POST', data: Object.fromEntries(form) }); event.target.reset(); notice(''); await session(); } finally { button.disabled = false; } }); });
$('#logout').onclick = () => safely(async () => { await api('/api/logout', { method: 'POST', data: {} }); submission = null; $('#report-form').reset(); showLogin(); notice('Signed out.'); });
$('#refresh').onclick = () => safely(refresh);
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => safely(() => changeView(button.dataset.view)); });
$('#report-form').addEventListener('submit', event => {
 event.preventDefault(); safely(async () => {
  const form = new FormData(event.target); const file = form.get('screenshot'); form.delete('screenshot'); const data = Object.fromEntries(form);
  for (const key of ['project_id', 'viewport_width', 'viewport_height']) data[key] = Number(data[key]);
  const fingerprint = JSON.stringify(data) + (file?.size ? `${file.name}:${file.size}:${file.lastModified}` : '');
  if (!submission || submission.fingerprint !== fingerprint) submission = { fingerprint, key: crypto.randomUUID(), upload: null };
  const button = $('#submit-report'); button.disabled = true;
  try {
   if (file?.size && !submission.upload) { const upload = new FormData(); upload.append('screenshot', file); submission.upload = (await api('/api/uploads', { method: 'POST', form: upload })).id; }
   if (submission.upload) data.upload_id = submission.upload;
   const result = await api('/api/requests', { method: 'POST', data, key: submission.key });
   submission = null; event.target.reset(); notice(`Report #${result.ticket.id} received. Awaiting investigation.`); await changeView('queue'); await detail(result.ticket.id);
  } finally { button.disabled = !me?.projects.length; }
 });
});
session();
