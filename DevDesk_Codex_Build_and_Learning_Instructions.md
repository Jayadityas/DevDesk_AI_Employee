# DevDesk Codex Build and Learning Instructions

Prepared 10 October 2026. Copy this complete document into Codex or attach it and instruct Codex to read it fully. This is the active product specification. It supersedes the earlier procurement scenario and the triage-only DevDesk blueprint wherever they conflict.

## 1 Your role and my goal

You are my implementation partner and technical teacher. Help me build DevDesk for CentrAlign's Founding Engineer AI Employee problem statement. I must understand the actual source code well enough to explain its architecture, follow its decisions, debug failures, modify a feature live, and discuss reliability, security, scalability, and extensibility.

Build working software incrementally. Do not generate an entire opaque repository in one turn. Do not stop at descriptions when a phase authorizes implementation. Explain concrete design choices and show real verification. Never claim a feature is complete because code exists.

Deadline supplied by me: 12 October 2026 at 11:59 PM IST. This supersedes the date in the original JD. Do not assume unlimited development time. Prioritize the smallest complete working repair loop, then concurrency, voting, recovery, and packaging. A working narrow system is more valuable than broad simulated capabilities.

My development machine is Windows, with WSL available from prior setup. Confirm the actual environment rather than assuming Docker, versions, GPU, or model credentials. I have approximately 66 GB free on C drive. Avoid large local model downloads, unnecessary frameworks, or duplicate dependency environments. Never print secrets or request that I paste an API key into chat; use a local ignored environment file.

## 2 Mandatory learning workflow

For every phase, BEFORE editing code, explain:

1. The phase's purpose in plain language and a concrete user example.
2. What already works and what this phase adds.
3. Files/modules and interfaces you will create or modify.
4. The request-to-result flow, including database effects.
5. Why you chose this design, one reasonable alternative, and the tradeoff.
6. The successful case and meaningful failure cases we will check.
7. What the phase does not claim to support.

Then implement that phase completely, run appropriate checks, and correct failures within its scope. Do not repeatedly ask permission for routine edits, reads, tests, or debugging already authorized by the phase.

AFTER implementing a phase, provide:

- What now works, with actual evidence.
- File and function pointers for important behavior; avoid dumping every generated line.
- Exact commands appropriate to my observed environment, identifying PowerShell versus WSL/bash.
- A manual walkthrough: where to open, what to enter, what to click, expected visible result.
- A trace of one request through functions, tools, records, and checks.
- Tests actually run and their observed results; say when a check was not run.
- Known limitations and remaining concerns.
- Three short interview questions and suggested explanation outlines.
- One small exercise I can perform, such as changing a rule or reproducing an error.
- Updated learning/status documentation and next phase preview.

Pause at the END of each phase for my learning checkpoint. Ask me to reply "continue" when ready. This pause is my explicit teaching preference, not a security approval requirement. If I explicitly ask to proceed through several phases autonomously, honor that instruction while retaining the explanations and documentation. Do not advance to dependent phases without my continuation under the default teaching workflow.

If I ask a question midway, explain it using the actual implementation and resume the authorized phase. Be concise on routine details and detailed on important control paths. If a critical scope change or missing requirement appears, explain it before dependent work; resolve ordinary choices yourself.

## 3 Product and demonstration environment

DevDesk is a bounded autonomous software-maintenance employee. Human employees submit bug reports with optional screenshots or feature requests through a workbench. DevDesk independently investigates, creates a ticket, obtains appropriate authorization, edits an isolated checkout of a small playground application, verifies a candidate change, asks the requester to accept it, integrates accepted changes, and completes the ticket with evidence and notifications.

Create three parts:

A. Playground: a small Team Tasks application with task cards, a creation form, statuses, filters, and real backend persistence. Its source is what DevDesk may repair.
B. Workbench/control plane: employee login, report submission, screenshot upload, active queue, approvals, feature polls, preview/evidence review, notifications, completed/rejected history, and task events.
C. Worker/runtime: decision loop, browser observation, scoped source tools, restricted test/build runner, permissions, isolated workspaces, verification, persistence, queue scheduling, and integration.

Workbench and runtime source are protected. The runtime may modify only the separate playground repository/checkout within an explicitly permitted path. It must never edit its own permissions, worker, approval logic, trusted evaluator, or credentials to make a task succeed.

Use synthetic employee accounts and fictional business data. No real employer source, company credentials, confidential logs, real email recipients, production access, or unauthorized third-party systems.

We initially support controlled examples, not all frontend/backend issues:

- Frontend defect: task-card action buttons overlap at a specified viewport.
- Backend defect: a status filter returns tasks from the wrong status.
- Feature: add a completed-tasks filter or a comparably small agreed extension with observable acceptance criteria.

Avoid making the feature indistinguishable from the seeded backend defect. Use separate clean baselines or reset fixtures so each scenario has independent behavior and expectations. After implementing the playground, propose exact fixtures and acceptance checks before building repair behavior.

Defects are introduced through clearly labeled fixture/reset controls or manual authorized source edits. Do not add a repair table mapping defect IDs to known patches. AI actions and resulting changes must be real.

## 4 Bug workflow and authorities

Submission captures authenticated reporter identity, project, description, reproduction information, page URL from an allowed playground origin, viewport, screenshot, and reported impact. The screenshot is a clue, not conclusive proof.

Persist the request immediately. Assign deterministic priority from validated fields. The employee investigates independently and records baseline evidence. It creates the linked ticket automatically once the investigation record exists; the request itself authorizes ticket creation. Ticket creation must be idempotent. Unconfirmed reports remain identifiable and may request more information instead of receiving invented confirmation.

Before modifying source, present the reporter with a scope proposal: confirmed behavior, supported evidence, intended area, acceptance criteria, allowed files/actions, base commit, risk, expiry, and limits. The reporter is the source-change approver. Another employee cannot approve it merely because they can see the queue.

After approval, edit only an isolated task checkout. Run the preview and permitted checks. Re-observe, revise within bounded attempts, and remove unsuccessful or unrelated changes. A material expansion of scope requires fresh approval.

When required checks pass, create a candidate patch commit and show before/after screenshots where applicable, diff, test results, limitations, and a preview link. Send persistent notification that the candidate is ready for review, not that the shared application is already fixed.

The reporter accepts or rejects the exact candidate commit/evidence version. Rejection returns it for bounded rework or closes it as rejected if the reporter requests that. New patches invalidate prior candidate acceptance.

Only after acceptance, integrate into the shared playground under a project integration lock. Validate the base and rerun required checks on the integrated tree. Mark completed only when integration checks pass. If integration changes the candidate materially or introduces a conflict, pause/rework and renew acceptance as needed.

Source-edit approval and final candidate acceptance are distinct records. Keep them distinct in UI and code. Completing an investigation is not fixing a bug, and passing selected checks is not "100 percent certainty". Final output says which checks passed and what remains untested.

## 5 Feature voting

For a feature request, first create a clear feature proposal with scope and acceptance criteria. Create the linked ticket and open a poll to every eligible active employee in the project's roster.

Snapshot eligible employee IDs at poll creation. Each authenticated eligible employee, including the requester, gets one vote. Use explicit yes/no choices; prefer immutable votes in the initial implementation and disclose that rule. A new employee added after creation does not silently change the denominator.

Required approvals = ceil(2 * N / 3), where N is the roster snapshot size. For N=4, require 3; for N=5, require 4; for N=6, require 4. Require at least one eligible employee; an empty roster blocks the poll rather than automatically approving it.

Notify all eligible accounts and collect votes concurrently. Voting does not block the worker. Configure and show the poll deadline. Nonresponses are nonapprovals at the deadline. Approve once the threshold is reached; reject when the deadline expires without sufficient votes or when remaining possible votes cannot reach the threshold. Ensure transactional vote uniqueness and race-safe resolution.

On insufficient support, mark the ticket INVALID with reason insufficient_consensus, notify the requester with count/threshold, remove it from the active queue, and retain it in rejected history. INVALID is a product label for insufficient authorization, not a judgment that the idea is unreasonable.

Passing consensus authorizes the displayed feature scope. It does not authorize forbidden actions. A materially changed feature proposal needs a new poll; minor implementation choices within approved scope do not. After approval, use the same isolated implementation, verification, requester acceptance, and integration path as bugs.

## 6 Queue and concurrent submissions

Allow concurrent submission, investigation events where safe, voting, and human responses. Persist queue and history in the database, not browser memory. Refresh and restart must preserve state.

Use trusted deterministic priority policy with visible rules. Starting policy: P0 confirmed loss or essential workflow outage; P1 core functionality broken broadly; P2 local functional defect with workaround; P3 cosmetic defect or approved enhancement. Reported impact is provisional evidence; high-priority assertions require supporting observations or authorized review. Record rule ID and explanation. Define objective impact inputs and fixture mappings before implementing the classifier; avoid vague model-only priority scoring.

Order eligible work by priority, then submission time, then stable ID. Unapproved source changes and unresolved polls are not eligible for repair. Waiting for approval or acceptance must not freeze the entire queue.

Initially allow one active source-edit/test repair per project. Do not preempt an in-progress edit destructively. When it produces a candidate awaiting acceptance, release repair capacity and process the next eligible request in another isolated workspace. Multiple candidate branches may wait, but integration is serialized. Stale bases must be handled explicitly.

A completed ticket moves from active views to completed history; invalid, cancelled, failed, and rejected outcomes remain retained and filterable. Do not delete audit records. Add starvation mitigation as a documented future improvement if not implemented.

## 7 Runtime architecture and stack

Prefer a modular monolith with an API/workbench, separate durable worker, database, and isolated execution runner. Initial recommendation: Python/FastAPI/Pydantic, PostgreSQL, Playwright Chromium, minimal HTML/JavaScript frontend, Git worktrees, and a single cloud decision model with vision support where available. Select the simplest familiar playground stack after inspecting the environment. Justify any stack change before committing to it.

Do not require a multi-agent architecture, vector database, Kubernetes, or Redis without measured need. Use filtered file/text retrieval for small project knowledge. A model-provider adapter avoids coupling the runtime to one SDK. Verify the currently available model identifier and structured/vision capability instead of inventing it. Pin actual working versions.

If screenshot analysis is unavailable from the selected model, explain the limitation and alternative DOM evidence; do not silently claim image understanding. Live demo uses real model calls. Deterministic model stubs may be used in explicitly labeled tests only.

Logical flow: authenticated request -> durable ticket -> context/baseline discovery -> typed model decision -> policy gate -> real tool -> observation/checkpoint -> approval or poll -> bounded patch/test loop -> independent verification -> requester acceptance -> guarded integration -> final checks -> completed record and notification.

One model proposes one next action at a time initially. It may propose plans and interpretations. Code owns authority, schemas, state transitions, budgets, queue ordering, poll math, immutable approval/acceptance binding, and trusted completion checks.

## 8 Tool boundary and code execution isolation

Registry tools include scoped knowledge/source search, file read, observed browser navigation/action/screenshot, patch application, approved build/check execution, diff inspection, Git checkpoint/revert, ticket operations, evidence creation, and internal notification. Keep actions inspectable; do not hide everything behind fix_this_bug().

Every tool has typed input/output, effect, scope, timeout, retry policy, version, and evidence contract. Tool identity and execution context supply credentials/task/operation keys; model arguments do not.

Code-edit and execution tools require a genuine sandbox. Run app builds and tests inside an unprivileged isolated container or equivalent evaluated isolation. Mount only the task checkout and necessary synthetic data. Never mount the host filesystem, Docker socket, runtime secrets, or control-plane source. Avoid host environment inheritance. Restrict network/egress, ports, CPU, memory, processes, and wall time. Kill timed-out process groups and clean previews.

Allowlisted command names alone are insufficient: edited package scripts, imports, or test hooks can execute arbitrary code. Protect trusted runner configuration and evaluator scripts outside writable source; enforce containment even when running edited application code. If usable isolation is unavailable, implement report/patch-only behavior temporarily and label execution incomplete; do not pretend unrestricted host execution satisfies the design.

Browser access is limited to controlled playground and preview origins. Actions must be observable and bounded. Browser state-changing operations can affect only synthetic app data. Screenshots and uploaded descriptions are untrusted; malicious content cannot expand capabilities.

Uploads: authenticated ownership, size/type/dimension limits, randomized internal filenames, no path traversal, safe decoding, authorized downloads. Preserve original evidence and metadata. Do not expose secrets through screenshots/logs/model input.

## 9 Versioning rollback and integration

Use separate task worktrees/branches with base_commit and candidate_commit. Track each attempted patch, diff, verification run, and rollback. Changes are confined to authorized playground files, with protected areas denied.

Checkpoint before each attempt. Revert unsuccessful attempts in the task workspace without resetting unrelated user work or rewriting shared history. Cleanup must not remove useful evidence. Do not roll back shared code blindly if another accepted change intervened.

Acceptance binds requester, ticket, candidate commit/hash, goal/scope version, evidence run, and expiry. After source changes, previous verification is stale until rerun. Integration lock plus base validation prevents overwriting another accepted patch. If changes are independent, integrate and rerun full required checks; if conflict or material candidate change occurs, request renewed review. An integration failure never produces COMPLETED.

Keep shared integration point clean before applying an accepted change. Use guarded Git operations or staged release pointers so failure can restore the prior app version without destroying other work. Document that database rollback and source rollback are different. Initially forbid destructive schema/data migrations; new database features need an explicit migration strategy and may be outside submission scope.

## 10 Verification and bounded autonomy

Reproduce before editing. A screenshot report includes viewport and page/context; exact image matching alone is insufficient. For overlap use browser geometry, visibility, clicks, before/after screenshots, and a relevant second viewport. For backend filtering use fixed seeded inputs and API outputs. For a feature, define observable acceptance criteria before voting.

Trusted checks are owned outside the writable task checkout. The agent may add useful project tests but must not alter the trusted evaluator or weaken assertions to pass. Baseline should fail relevant regression checks; candidate should pass them and applicable regression checks. Existing baseline failures are recorded separately. Exit code zero or a model statement alone does not establish correctness.

Semantic image judgments are supporting evidence, not guaranteed truth. Return PASS/FAIL/UNKNOWN for required assertions and evidence references. Unknown mandatory checks block completion. Record exact commit and app build used for every screenshot/check. Recheck after shared integration.

Set configurable limits on actions, model calls/tokens/cost, active time, patch attempts, commands, and retries. Suggested starting values: three patch attempts, two safe transient-read retries, one schema repair, and repeated unchanged-action detection. Adjust based on observed task behavior. Do not retry ambiguous writes blindly. Exhaustion produces needs-human/partial/failed with retained evidence.

## 11 Durable state and notifications

Ticket states should clearly represent queued/investigating, needs information, awaiting bug approval, awaiting feature vote, ready, implementing, verifying, awaiting requester acceptance, integrating, completed, invalid, failed, cancelled. Finalize the permitted transition table in design phase. Do not make completed reachable directly from model output.

Persistence: employees/project roles, requests/screenshots, tickets/priority, events, task leases, observations, tool operations, proposals/approvals, polls/roster/votes, workspaces/commits, verification runs/assertions, candidate acceptances, integration attempts, artifacts, notifications. Use unique operation keys and record revisions.

Worker heartbeat/leases and fencing guard concurrent progress. On restart, inspect in-flight commands/previews and ambiguous operations, reconcile state, then resume. Leases do not guarantee exactly-once external effects. Make ticket creation, comments, notifications, and integration bookkeeping idempotent. For notifications use a transactional outbox with deduplicated delivery; at minimum persist delivery intent with ticket transition.

In-app notifications are mandatory and satisfy the requested notification alternative. Notify report acknowledgment, approval/vote request, candidate ready, consensus rejection, completed integration, and blocked/failure states as appropriate. Real email is optional only after the core works; use configured recipient scopes and do not contact real people without my explicit instruction.

## 12 Phase plan and learning checkpoints

Phase 0 Inspect and design: inspect existing repo/environment/JD if available, protect existing work, resolve critical model/isolation prerequisites, propose exact module map, state transitions, fixtures, checks, and stack. Create SPEC.md, ARCHITECTURE.md, BUILD_STATUS.md, and LEARNING_LOG.md. Stop for my design checkpoint; no whole-product implementation yet.

Phase 1 Playground: build clean Team Tasks app, seed/reset, frontend and backend, and labeled defect fixtures. Let me reproduce each defect manually. Establish baseline checks, without autonomous repair.

Phase 2 Workbench and persistence: synthetic login, report/screenshot submission, tickets, deterministic provisional priority, queue/history, and notification records. Verify refresh and authorization. No fake autonomous timeline.

Phase 3 Read-only employee: actual model-selected tools retrieve instructions/source and reproduce a defect through browser/API. Store real observations and baseline evidence. No source editing yet.

Phase 4 Approval and bounded repair: reporter-only scope approval, isolated worktree, safe runner, restricted source patch tools, real model-driven patch/check/revise loop. Complete one frontend candidate with traceable diff and evidence.

Phase 5 Acceptance and completion: requester reviews exact candidate, accepts/rejects, serialized integration, integrated verification, persistent completed history and notification. Demonstrate full single-bug path.

Phase 6 Reliability and queue: restart recovery, duplicate-effect guards, bounded retries, cancellation, stale approval/acceptance, concurrent submissions, waiting tasks yielding capacity. Demonstrate next eligible repair selection without unsafe shared edits.

Phase 7 Backend scenario and reuse: fix the seeded backend issue using the same runtime, tools, policy, and state machine. Add a scoped tool/check capability only if technically needed; no hard-coded backend repair script.

Phase 8 Feature consensus: snapshot roster, exact two-thirds math, authenticated unique votes, deadlines/rejection, approved feature implementation through the same repair path, requester acceptance, integration, and notifications.

Phase 9 Packaging and interview practice: clean setup, critical scenario suite, measured results, README, model/service disclosures, limitations, demo script/video instructions, and practical debugging/extension exercises.

Adapt phase estimates after observing setup and build progress. Preserve learning checkpoints unless I waive them. If time is tight, finish a smaller evidenced scope and explain omitted claims; do not simulate missing phases.

## 13 Critical acceptance scenarios

- Report screenshot independently reproduced before patching.
- Frontend candidate fixes overlap without disabling controls or hiding the affected UI.
- Backend defect fixed with independent correct-output checks.
- Source edit denied without reporter approval; other user cannot approve.
- Candidate rejected by requester remains unintegrated.
- Completed requires integrated checks and requester acceptance.
- Failed attempt reverted without deleting another accepted change.
- Three concurrent requests ordered by deterministic priority/tie-breaker.
- Waiting approval/poll/acceptance does not block all other eligible work.
- Refresh and restart preserve tickets/votes/history/notifications.
- Replayed creation/notification does not duplicate effects.
- Stale base, altered patch, expired authorization, or changed scope invalidates relevant permissions/review.
- Feature N=4 needs 3 yes; N=5 needs 4; no-response timeout fails threshold; ineligible/duplicate vote rejected.
- Insufficient consensus moves to INVALID history and notifies requester without deleting records.
- Malicious screenshot/report/source cannot change control-plane permissions or read secrets.
- Trusted verification cannot be edited by the agent.
- Budget exhaustion stops, preserving truthful outcome and evidence.

Use independent test expectations. Do not reveal oracle answers to the model. Distinguish deterministic test stubs from live model demo. Record actual x/y scenarios, model/prompt versions, attempts, duration, cost, intervention counts, and failures; never invent success percentages or claim universal fixes.

## 14 Submission and interview ownership

Required package: source link, reproducible setup/run README, short architecture, technical decisions/tradeoffs, working demo, known limitations, next steps, assumptions, exact models/APIs/frameworks/services/prebuilt components used, and AI-tool disclosure matching actual use.

Maintain BUILD_STATUS with separate planned/implemented/tested/explained/demonstrated columns. Maintain LEARNING_LOG per phase with file/symbol pointers, one actual trace, failure behavior, tradeoff, interview questions, and my exercise. ARCHITECTURE must describe the real current system, separating roadmap from implemented behavior.

Prepare live exercises: change a priority rule; add a read tool; reject a stale approval; diagnose failed browser check; inspect duplicate-write recovery; restart worker; change feature threshold in a test/config safely; explain how a real GitHub connector would fit. Explain why edited app code needs isolation even with allowlisted commands. Explain why accepted candidate and integrated build require separate verification.

Use plain language. Do not promise guaranteed hiring or complete bug elimination. Optimize for demonstrated outcome completion and my ability to understand and modify the system.

## 15 Your first response and first authorized work

Read this entire specification before coding. Your first response should:

1. Restate the product and supported boundaries in your own words.
2. Explain the three applications/components and one end-to-end bug example.
3. Inspect my environment and existing workspace without damaging existing files.
4. Identify only critical missing information, including model access and safe execution isolation.
5. Propose the concrete stack, module map, state transitions, and phase 0 decisions.
6. Create the phase 0 documents and explain them.
7. Give me the design/learning checkpoint and wait for "continue".

Do not start every phase at once. Do not revert to the old triage-only or procurement plan. The objective is actual bounded source repair and approved feature implementation, with verifiable outcomes and human acceptance.
