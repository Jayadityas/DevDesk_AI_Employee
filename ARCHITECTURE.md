# DevDesk architecture

## Phase 9 packaging

Source packaging uses an explicit allowlist, selected playground Git refs, manifest hashes and assertion-only report extracts. Credentials, databases, uploaded images and native/runtime builds stay outside the archive. Package bootstrap restores accepted or original baseline worktrees without resetting existing sources. A generic profile runner check supports fresh packages without this machine's historical evidence files. Current regression/startup, archive extraction, secret checks and Git restoration were observed; fresh external dependency installation/new cluster provisioning were not. See [Phase9 guide](docs/PHASE9_PACKAGING_GUIDE.md), [setup/demo](docs/SETUP_AND_DEMO.md) and [disclosures](docs/DISCLOSURES_AND_LIMITS.md). Source publication, video and GitHub synchronization remain external/future work.

## Phase 8 implementation

C++ consensus.cpp adds feature_polls, feature_poll_members and unique feature_votes to the PostgreSQL control plane. The published scope, roster and deadline form a goal binding; authenticated CSRF-protected choices cannot change on replay. Ticket/poll locks and transactional deduplicated notices guard closure. Open polls yield worker capacity; ceil(2N/3) plus reporter scope approval enables READY, while timeout/impossibility records INVALID/history. Runtime permissions preserve snapshot/vote rows and limit poll updates to state/closed_at. Registered feature profile permits only reviewed navigation buttons in static/index.html. The shared investigator, model patch loop, Docker evaluator, exact requester review and guarded integration are reused, with current consensus rechecked at effect boundaries and recovery. Fixed runner adds two viewport filter checks to the existing20; all22 candidate/integrated assertions passed in the real Gemini demonstration. Feature preview uses its own internal app network and mount-free localhost relay at8083. Main reports remain preserved; GitHub synchronization and packaging are future work. See [Phase 8 guide](docs/PHASE8_FEATURE_GUIDE.md).

## Phase 7 implementation (historical checkpoint)

A protected repair profile binds controlled origin, shared fixture, editable file/function, baseline failure and mandatory checks across C++ routes, worker, repair, exact requester review, integration and recovery. The backend capability is a bounded list_tasks function edit, not a hard-coded patch selector. Gemini supplies the SQL diff through the existing tool loop. Backend evaluator UID 10002 builds protected source and independently reads SQLite through a fixed C++ reader; edited app UID 10001 cannot access private result files or signal the evaluator in the tested canaries. The same runner retains 20 frontend checks and adds six backend checks. Candidate and post-integration checks bind exact file/source identity. Scope/hash/profile/expiry changes invalidate authority. Both accepted-source previews use separate internal app networks, dedicated synthetic data and trusted mount-free ingress relays. The real backend ticket completed only after reporter acceptance and all 26 integrated checks passed. See [Phase 7 guide](docs/PHASE7_BACKEND_GUIDE.md); subsequent feature consensus and GitHub synchronization remain roadmap items. Older phase descriptions below are historical.

## Phase 6 implementation

Workers acquire global project capacity before reconciliation and claims. PostgreSQL advisory locking and an exclusive Windows handle own capacity; heartbeat records and monotonically increasing fences guard active transitions and helper effects. Uncertain operations are not replayed. Cancellation is immediate for waiting work and acknowledged at safe boundaries for active work. Exact scope/candidate expiry and clean-source checks invalidate stale authority. The continuous launcher adds recovery and preview activation. Accepted application code builds and runs in an internal-network Docker container with read-only source and dedicated synthetic data; a separate trusted relay without mounts provides fixed localhost ingress. See [Phase 6 guide](docs/PHASE6_RELIABILITY_GUIDE.md). Older phase boundaries below are historical.


Phase 3 update (11 October): C++ worker -> strict provider action -> trusted policy -> fixed source/API/Chrome helper -> persisted observation -> next decision/conclusion. PostgreSQL stores runs, decisions, observations and worker events; the workbench displays evidence and notifications. Advisory-lock capacity and recovery prevent concurrent claims/replay of ambiguous calls. Immutable releases freeze worker, prompts, helper and assets. Source-write/approval/integration authority remains absent. Windows Job Object limits are not arbitrary-code filesystem isolation. Full contracts and limitations: docs/PHASE3_INVESTIGATOR_GUIDE.md. Offline checks and the live Gemini pilot passed.

## Phase 5 implementation update

Requester reviews bind exact candidate, scope, evidence and expiry. Immutable accept/reject records precede integration. A global database advisory lock serializes the shared Git integration point; source identity and clean-checkout guards precede fast-forward. Docker preflight occurs before mutation. Post-integration container checks gate COMPLETED and transactional history/notification. Failure can restore authorized CSS using a new rollback commit, with no overwrite of intervening or dirty user work. Start-Workers.ps1 polls integration/investigation/repair in one terminal; no Windows service is installed. Real integration passed; an explicit private-clone Docker fault exercised Git rollback. Crash recovery and preview activation remain limitations. See docs/PHASE5_ACCEPTANCE_GUIDE.md.

## Phase 4 implementation update

Reporter-only versioned scope approval precedes a bounded CSS repair worker and detached Git checkout. The fixed container runner passed independent containment and timeout probes. Compilation, browser/API checks and failed-patch rollback run in restricted container storage; source digests bind results to the checked bytes. The real Gemini workflow produced a candidate commit with all 20 required assertions passing. Fixed, bounded artifact reads export reports/screenshots before container cleanup. Explicit patch-only fallback cannot claim verification. See docs/PHASE4_REPAIR_GUIDE.md. Final acceptance/integration remain Phase 5. Earlier Phase 3 descriptions below record that phase's boundaries.

## Current reality

Phases 1 and 2 implement the local Team Tasks playground and separate protected C++ workbench. The workbench has synthetic authentication, validated reports and original screenshots, PostgreSQL transactions, queued investigation/ticket records, provisional deterministic priority, persistent queue/withdrawn history, and in-app notifications. Phase 3 adds a durable read-only worker/model adapter with INVESTIGATING, INVESTIGATED_READ_ONLY and NEEDS_INFORMATION states. Approvals, voting, repair, integration and an isolated execution runner remain roadmap.

## Implemented workbench flow

devdesk/src/main.cpp loads ignored runtime configuration, opens the dedicated PostgreSQL 17.11 database and serves frozen build/static assets on loopback. support.cpp wraps libpq connections/results/transactions in RAII and binds all user values with PQexecParams. routes.cpp authenticates hashed sessions, checks project membership and CSRF, validates report/image ownership, and owns policy. image.cpp uses Windows WIC for complete bounded raster decoding; original bytes and metadata are retained outside the web root. Windows CNG supplies random tokens, SHA256 and salted PBKDF2 password hashes.

POST /api/requests starts one transaction, locks the reporter row, checks operation-key/payload-hash replay, inserts request, queued investigation, linked unconfirmed ticket, submitted event and acknowledgement notification, then commits. Provisional cosmetic/feature priority is P3; other validated reported impacts are P2 pending evidence. No high priority or repair authority is inferred from assertions. Queue sorts priority/time/ID; only the requester can withdraw a queued report. Withdrawal retains records/evidence/events and notifies the requester. Notifications are private in-app delivery records with persisted read receipts; no external dispatcher/email exists.

Setup-DevDeskPostgres.ps1 owns an isolated local cluster at var/postgres-data on 5433; it leaves the existing 5432 server unchanged. Bootstrap, schema ownership and restricted runtime roles are separate. Runtime cannot create normal/TEMP tables, delete tickets, rewrite events, or administer roles/databases. One mutex-protected connection serializes API DB work; employee row locks and unique constraints also protect duplicate submission across separate API processes. This is a bounded modular monolith, not a throughput benchmark. Full actual module/API/table map and evidence are in docs/PHASE2_WORKBENCH_GUIDE.md.

## Implemented playground flow

main.cpp opens the explicitly selected database and mounts the build-time static asset snapshot. --seed is a developer CLI mode that transactionally replaces synthetic task rows and exits; no reset HTTP route exists. The normal server binds 127.0.0.1 with four HTTP worker threads. Route validation accepts supported fields/statuses only; task_repository.cpp uses one mutex-protected SQLite connection, prepared statements, RAII finalization and WAL persistence. Its database file is outside the source repository.

app.js handles the form, filter and task action clicks. POST /api/tasks validates input, calls create_task, inserts a row, reads its assigned ID and returns 201. loadTasks fetches stored rows and renders task text with textContent. PATCH advances/reopens a status; DELETE removes a task after browser confirmation. The page is not a workbench and has no employee identity.

Build-Playground.ps1 embeds commit and source digest through a generated header, copies static assets to build/static, links the installed SQLite runtime and copies required DLLs. Builds and screenshots use the same frozen asset snapshot. Initialize-Fixtures.ps1 creates independent frontend/backend/feature worktrees from phase1-clean and introduces source defects, with no repair tool. trusted_checks/phase1.mjs launches real servers and Chrome against fresh independent databases, preserving assertions and screenshots. These developer-authored host checks are not an evaluated sandbox for model-edited code.

## Stack decision

User-approved revision: use C++20 for playground backend, workbench API, worker and policy. Playground uses tested cpp-httplib 0.60.1, nlohmann/json 3.12.0 and SQLite 3.53.4, compiled with MSYS2 UCRT64 GCC 16.2.0. JavaScript Playwright 1.64.0 uses installed Chrome. Control-plane PostgreSQL/libpq 17.11 with RAII and parameterized queries now works; MinGW links the installed libpq.lib import library (direct DLL linking failed at startup). Keep plain HTML/CSS/JavaScript interfaces, Git worktrees and planned restricted Linux task containers. The explicit PowerShell build scripts work; no CMake dependency is needed currently. Current workbench crypto/image adapters are Windows-specific.

C++ matches the user's stronger experience and interview ownership goals. Python/FastAPI would offer faster integration, but unfamiliar implementation code creates a learning cost. C++ adds compilation, dependency linking and explicit validation work; use small modules, RAII, bounded inputs and straightforward interfaces. SQLite keeps each small playground preview's synthetic data independent, using a compiler-compatible installed library without PostgreSQL credentials. PostgreSQL remains the control-plane choice for row locks and durable queue coordination. These are separate stores, not a claim that SQLite implements the worker concurrency plan. A modular monolith plus separate worker keeps policy inspectable without multi-agent or distributed-service complexity.

References consulted for revision: https://github.com/yhirose/cpp-httplib, https://www.postgresql.org/docs/17/libpq.html and https://playwright.dev/docs/library. cpp-httplib uses blocking HTTP/1.1; adequate for this bounded demo, not a claimed high-throughput architecture. Cloud model HTTPS transport and certificate validation must be verified before Phase 3. Docker security reference: https://docs.docker.com/engine/security/. Docker availability alone does not establish safe containment.

## Proposed module map and interfaces

| Path | Responsibility and important planned interface |
| --- | --- |
| playground/ | Separate Git repository: src/main.cpp, routes.cpp list_tasks/create_task/update_task, task_repository.cpp; static/index.html, app.js, styles.css; synthetic persistent data |
| devdesk/api/ | Authenticated report, upload, scope approval, vote, acceptance, history and notification routes |
| devdesk/domain/ | transition_ticket, authorize_scope, validate_acceptance, classify_priority, resolve_poll; trusted policy |
| devdesk/db/ | Models, transactions and migrations; revisions, operation keys, leases, outbox |
| devdesk/worker/ | claim_work, renew_lease, step, reconcile; one typed next action at a time |
| devdesk/model/ | Provider adapter decide(context) -> typed action; actual provider pending |
| devdesk/tools/ | Typed registry: source search/read, browser observation, patch, permitted check, diff, checkpoint, evidence, ticket, notification |
| devdesk/runner/ | Trusted container launcher, resource/network policy, timeout and preview cleanup |
| trusted_checks/ | Independent evaluator, never mounted writable or disclosed as an oracle to the model |
| tests/ | Policy, authorization, concurrency, recovery and end-to-end checks |
| var/ | Ignored uploads, evidence and isolated task workspaces; secrets never mounted in runner |

Implemented Task and TaskRepository declarations provide the playground data interface; route JSON decoding validates required fields, types, enums, byte limits and unknown fields before database effects. Actual Phase 2 code is under devdesk/src, not the proposed future api/domain split above; Result, Database and Transaction own libpq resources and transaction guards. Planned worker headers will declare typed request/action/result structs. A planned fixed JavaScript Playwright helper will exchange bounded JSON through stdin/stdout with the C++ worker; model input must never supply arbitrary executable names or scripts. Current browser checks are developer tooling outside writable playground source. Windows control-plane linking/access is tested; Linux portability remains unverified.

Do not expose a generic shell tool. Tool contracts include schema/version, effect, scope, timeout, retry and evidence. Worker injects identity, task and operation keys; model cannot supply authority. Canonical path checks must reject traversal, symlink escape and protected files.

## Planned durable request flow

Authenticated submission transaction inserts request, upload metadata, priority explanation, event and acknowledgment outbox intent. Worker creates investigation record and idempotently links a ticket. It observes allowed origins and stores reproduction evidence. Unconfirmed reports become needs_information. Confirmed bug creates versioned scope and reporter notification. Feature creates proposal, roster snapshot, poll and notifications.

Authorization makes a ticket ready. Worker claims project repair capacity with lease and fencing token, creates a worktree at base_commit, checkpoints, and executes policy-gated model actions. Verification stores PASS/FAIL/UNKNOWN assertions against exact build/commit. All mandatory checks must pass before a candidate commit is presented. Awaiting acceptance releases repair capacity. Requester acceptance transaction records exact bindings and schedules integration.

Integration takes the project lock, checks clean shared tree and current base, applies accepted candidate, runs required checks against integrated tree, then atomically records completion and notification intent. Stale independent changes may be integrated with full checks only when the accepted change is preserved; conflict or material change requires renewed review. Failed integrated checks retain evidence and restore prior release safely; never mark completed. Source rollback does not undo database writes.

Planned records: employees/project roles, requests/screenshots, investigations, tickets/priority, events, leases, observations, tool operations, proposals/approvals, polls/rosters/votes, workspaces/commits, verification runs/assertions, acceptances, integration attempts, artifacts, notifications/outbox. Unique request-operation, ticket-request, vote-poll-employee, and delivery-operation constraints guard duplication. Revision checks reject stale writes. Leases alone do not guarantee exactly-once effects.

## Proposed permitted transition table

Requests begin queued; ticket creation occurs after investigation record exists. These are the ticket lifecycle states; completion is never a model-selectable transition.

| From | To | Required condition |
| --- | --- | --- |
| queued | investigating | Durable claim and fencing token |
| investigating | needs_information | Reproduction unknown; evidence retained |
| needs_information | queued | Authenticated additional information |
| investigating | awaiting_bug_approval | Confirmed evidence and versioned scope |
| investigating | awaiting_feature_vote | Clear feature proposal and nonempty roster |
| awaiting_bug_approval | ready | Current reporter approval |
| awaiting_bug_approval | investigating | Scope revision or expiry |
| awaiting_feature_vote | ready / invalid | Transactional poll resolution |
| ready | implementing | Valid authority, budget and project repair lease |
| implementing | verifying | Checkpointed scoped patch |
| verifying | implementing | Failed checks, attempts remain, rollback/revise |
| verifying | awaiting_requester_acceptance | Required PASS checks and candidate commit |
| awaiting_requester_acceptance | integrating | Exact valid acceptance and integration lock |
| awaiting_requester_acceptance | ready / rejected | Requester requests bounded rework / closure |
| awaiting_requester_acceptance | verifying | Verification or candidate freshness invalidated |
| integrating | completed | Integrated required checks PASS and acceptance valid |
| integrating | awaiting_requester_acceptance | Material change/conflict; fresh evidence needed |
| integrating | failed | Integrated checks fail; safe release restoration recorded |

Any nonterminal state may become cancelled by authorized requester or failed on exhausted budget/unrecoverable error, retaining all audit records. Active ambiguous operations must be reconciled before cleanup. Terminal states: completed, invalid, failed, cancelled, rejected. Expired feature authorization or material feature scope changes require a new poll, not a bug approval shortcut.

## Isolation and verification gates

Task code runs as unprivileged user, with only its checkout and synthetic data writable; no host tree, Docker socket, credentials or control-plane mounts. Drop capabilities, deny privilege escalation, restrict egress, ports, CPU/memory/processes, use read-only root with bounded scratch, and kill timed-out containers/process groups. Browser is restricted to exact controlled app/preview origins, including redirect checks. Trusted runner configuration remains outside editable source.

Uploads require authenticated ownership, randomized internal names, decoding validation and authorized download. Proposed limits: PNG/JPEG, 5 MiB, maximum 4096x4096 and decoded pixel cap; originals retained securely. No report/screenshot/source instruction can expand authority.

Evaluator observes app from outside the writable checkout with independent seeds and expected outputs. Agent-added tests are supporting evidence. Baseline failure, candidate success and integrated success are separate records. UNKNOWN mandatory assertion blocks completion. Restart reconciliation inspects operations, containers, Git and outbox before resuming with a fresh fencing token.

Gemini provider update: user selected gemini-3.5-flash-lite. Native Google generateContent requests use responseJsonSchema for one action, PNG/JPEG inline input and x-goog-api-key over fixed-host TLS. C++ policy checks remain authoritative. Gemini parser rejects incomplete/multiple candidates, unexpected model identity and inconsistent usage; non-input tokens conservatively include thinking. A GET models probe verifies generateContent support before inference. Configuration now selects provider gemini and rates $0.30 input/$2.50 output per million tokens (Google standard pricing); the $0.50 application estimate remains. Stable model aliases may evolve and are not immutable dated snapshots. OpenAI remains supported as an alternative. Live Gemini verification passed; the credential remains local and ignored. Official references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/pricing .


## Final Phase 3 verification — 11 October 2026

Implementation and live verification are complete; pause at the learning checkpoint. Build 070f5268e483b7889cfe1327737d8076fc1f500cb9745e54778c826991226a8a, investigation-v4, Gemini gemini-3.5-flash-lite. Final live report var/evidence/phase3-live-2026-10-11T13-15-55.785Z-87240/report.json: 8 PASS/0 FAIL, 36.266 seconds. Six model decisions: project instructions -> source list -> static/styles.css read -> API observation -> Chrome observation -> evidence-cited reproduced conclusion. Browser measured 1,360 pixels² overlap at 390x844; screenshot was saved and visually inspected. Source/data identity stayed unchanged. Run FINISHED; ticket INVESTIGATED_READ_ONLY, never COMPLETED. No source edit/approval/repair/integration occurred.

Live usage: 25,165 input and 679 output tokens (conservative thinking-inclusive count), estimated $0.011152 for the successful run. Earlier pilot receipts total an additional $0.016399 estimated; the first timed-out request's billing is unknown, so the complete session total is not established. Stable model alias is not an immutable dated snapshot. Accepted screenshot requests demonstrate input transport, not a visual reasoning benchmark. Failures exposed schema/prompt weaknesses; typed tool variants and prerequisite schema gating fixed the demonstrated path without bypassing policy.

Final same-build checks: 20 C++ self-checks PASS; Phase 3 scripted report var/evidence/phase3-2026-10-11T13-16-13.258Z-41412/report.json: 59 PASS/0 FAIL, 80.488 seconds; Phase 2 regression var/evidence/phase2-2026-10-11T13-16-13.656Z-98936/report.json: 95 PASS/0 FAIL, 20.790 seconds. Test servers were cleaned by their launchers; existing user workbench PID 115708 and frontend PID 21624 remain running. Existing PostgreSQL was preserved. Native HTTPS required approved execution outside the tool sandbox. No credential was printed.

Full map, commands, trace, manual walkthrough, three interview questions and learning exercise are in docs/PHASE3_INVESTIGATOR_GUIDE.md. The final live schema/tool changes were retested; repeated tests are now unnecessary absent a new change. Unverified: broad model reliability, live backend/feature scenarios, actual crash during billed inference, interactive Ctrl+C, Linux portability and arbitrary-code isolation. Scripted recovery used an abandoned record. Phase 4 must demonstrate repair isolation before any model-edited code execution and add explicit source-change approval. Do not interpret this read-only success as permission to edit source; wait for the user's continuation after learning.

