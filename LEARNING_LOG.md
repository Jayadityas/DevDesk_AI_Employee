# Learning log

## Phase 0: design checkpoint

Purpose: agree on how a report becomes a verified, accepted repair before writing the system. Example: employee reports overlapping task buttons; evidence, scope approval, candidate acceptance and integrated checks are separate steps.

Already working: no product. Added: SPEC.md for scope/fixtures/policy; ARCHITECTURE.md for proposed modules/interfaces/state transitions; BUILD_STATUS.md for honest evidence and pending gates. No database effects in Phase 0.

Design choice: modular Python control plane with durable PostgreSQL worker and separate playground Git repository. Alternative Node/React is viable but adds another build pipeline. Trusted code decides authority; model proposes actions. This permits teaching each function and auditing each operation.

### Actual Phase 0 trace

Read entire authoritative Markdown -> list workspace and commands -> git status confirms no repository -> version checks identify Python selection difference -> sandbox WSL check denied -> approved read-only check finds WSL2 installed but stopped and Docker engine unavailable -> create four documentation files. No application request trace is possible yet. Proposed future request trace is explicitly labeled in ARCHITECTURE.md.

### Observed checks and failures

Environment/version and disk checks ran; results are in BUILD_STATUS.md. Docker client presence did not imply running engine. No installation, secrets, model call, database write or application test occurred. Documentation existence/nonempty content checked after creation. Remaining prerequisites are model access and evaluated execution isolation; exact packages are not pinned yet.

### Manual walkthrough and exact commands

In the workspace file explorer, open SPEC.md, then ARCHITECTURE.md, then BUILD_STATUS.md. Expected visible result: proposed fixtures, explicit transition guards and future modules, with product implementation marked No. There is no app URL or button yet.

PowerShell, from C:\AI_employee:

```powershell
Get-Content -LiteralPath .\SPEC.md
Get-Content -LiteralPath .\ARCHITECTURE.md
Get-Content -LiteralPath .\BUILD_STATUS.md
py --list
git --version
docker version
wsl --list --verbose
```

Docker and WSL checks may require execution outside this agent's sandbox. No WSL/bash run command is validated yet; do not assume one.

### Interview questions

1. Why separate approval from acceptance? Approval permits scoped edits; acceptance approves the exact verified candidate, and changes invalidate prior acceptance.
2. Why verify after integration? Another accepted change can make a candidate's base stale; the shared build must satisfy checks independently.
3. Why isolate allowlisted tests? Edited imports, hooks and scripts execute code; trusted command names do not contain that code's effects.

Exercise: trace a requester rejecting a candidate through the proposed table. Explain why completed is unreachable and which evidence should remain. Then compare N=4 (3 approvals) with N=5 (4 approvals).

Next phase preview: implement and understand Team Tasks creation, persistence and filtering, introduce labeled defects, and reproduce baseline failures. Learning checkpoint: review the design and reply continue before Phase 1. This pause follows the user's explicit preference in section 2 of DevDesk_Codex_Build_and_Learning_Instructions.md, not a security approval requirement.

## Approved language revision

The user passed the Phase 0 checkpoint, then selected C++ because of stronger familiarity. C++20 now owns backend, worker and policy; HTML/CSS/JavaScript owns the frontend; JavaScript Playwright supplies a narrow browser interface. The Phase 0 Python discussion above is historical.

Actual trace: inspect compiler PATH -> g++ --version and -dumpmachine identify GCC 16.2.0, 64-bit Windows -> inspect build/database library locations -> consult official HTTP/libpq/Playwright documentation -> update SPEC, ARCHITECTURE, BUILD_STATUS and this log. No code or database effects. No compiler, linking or browser smoke test has run.

Tradeoff: C++ improves the user's ability to explain and modify the source, at the cost of more integration and build setup than Python. Planned file/symbol pointers remain proposed in ARCHITECTURE.md. No further design approval is required to resume the already authorized Phase 1.

PowerShell inspection commands actually run:

```powershell
g++ --version
g++ -dumpmachine
Get-Command cl,g++,clang++,cmake,ninja,vcpkg,psql -ErrorAction SilentlyContinue
```

Learning questions: Why RAII for a database result? It ensures cleanup on both success and exceptions. Why explicit JSON validation? Parsed JSON does not establish a permitted typed action. Why JavaScript for browser checks? It uses Playwright directly while C++ retains authority through a bounded interface.

Exercise: identify which layer must reject an unknown task status before SQL is executed. Next: resume Phase 1 with real C++ compile/link checks, not an assumption that compiler discovery proves the app builds.

## Phase 1: Team Tasks playground

### What now works and why

The separate playground Git repository contains a C++20 backend and an HTML/CSS/JavaScript interface. Create/list/filter/start/complete/reopen/remove use real SQLite rows. Data survives refresh and a process restart. Developer CLI reset transactionally restores four seeded tasks; there is no reset HTTP endpoint. Frontend, backend and feature baselines have independent source worktrees and databases.

SQLite is a deliberate playground-only choice: its installed compiler-compatible library avoids sharing PostgreSQL credentials with every preview. PostgreSQL remains planned for the control plane's locks, leases, voting and durable coordination. Alternative: PostgreSQL for both; it would add database provisioning/credentials per preview and setup time, without helping this small single-process task app.

Current files/functions:

- playground/src/main.cpp: CLI setup, seed mode, local server, four HTTP threads.
- playground/src/routes.cpp: register_routes at line 71; POST route at 107; field/parse_body validate JSON; safe converts validation failures to 400 and storage failures to a generic 500.
- playground/src/task_repository.cpp: list_tasks at 58, create_task at 73, update_task at 80, delete_task at 87, reset_seed at 93. Statement owns prepared SQL cleanup; TaskRepository owns the connection and mutex.
- playground/static/app.js: api at 9, loadTasks at 19, mutate at 53, creation handler at 63. Text uses textContent, not HTML interpolation.
- playground/static/styles.css: .task-actions at 50; clean responsive flex layout.
- tools/Build-Playground.ps1: generated metadata header, source digest, C++ linking, DLLs and immutable build-time asset snapshot.
- tools/Initialize-Fixtures.ps1: independent baseline source changes, no repair tool; repeat invocation preserves existing worktrees.
- trusted_checks/phase1.mjs: external independent expectations; actual HTTP and Chrome execution, no model stubs.

### One actual request trace

In the clean browser check, fill the creation form with literal text <img src=x onerror="window.taskXss=1"> and submit. Creation handler -> api POST /api/tasks -> register_routes POST callback -> parse_body/field type and byte validation -> TaskRepository::create_task -> Statement binds three values -> SQLite INSERT stores a new todo row -> sqlite3_last_insert_rowid/get_task -> task_json/respond returns 201 -> loadTasks GET -> list_tasks prepared SELECT -> textContent displays the literal title. Reload reads the same row again. The check confirms no injected image element or taskXss effect. Its Remove button and accepted confirmation issue DELETE, producing 204 and an observed return to four cards.

Separate API persistence check created task ID 5 titled Persistent O'Reilly <script> task, stopped the actual server, restarted it on the same database, and observed the same ID/title. Apostrophe input did not alter SQL structure. Cleanup removed that synthetic row. All check data lives under the run-specific evidence directory, separate from manual var/data databases.

### Tests actually run

Four successful C++ builds, seed executable smoke check, initializer creation/repeat preservation, documented launcher smoke/timed cleanup, clean Git status checks, and two API/browser suite runs (second includes snapshot metadata, reset, full status cycle and empty-state checks). Final suite took 24.270 seconds and recorded 169 PASS / 7 intentional FAIL across 176 assertions. Four of four baselines matched expectations. Chrome 154.0.8037.98, Playwright 1.64.0, Node 24.11.1, SQLite 3.53.4, GCC 16.2.0.

Final evidence: var/evidence/2026-10-10T15-55-30-050Z-45764/report.json and eight screenshots, with each scenario's source commit and exact build digest. var/evidence/latest.json is a pointer. The clean desktop and frontend mobile screenshots were visually inspected; geometry is independently measured, not inferred from image matching.

Expected failures stay labeled FAIL: Completed filter criterion in all baselines, mobile geometry in frontend, and todo API/UI filtering in backend. No unexpected assertion failures remain. Clicks, correct remaining status filters, seeded content at both viewports, invalid fields/status/IDs/queries, cross-origin write rejection, literal task-text safety, refresh/restart persistence, deletion, empty state and reset passed. Controls were not disabled or hidden to pass geometry.

Meaningful setup failures corrected: unavailable inherited Git signing key (per-command signing disabled); PowerShell macro quote stripping (generated header); npm cache sandbox denial (approved installation); older build metadata paired with live source assets (snapshot); child process retained after original launcher interruption (owned process cleanup). A compiler executable locked by that child was released safely. Sandbox WMI inspection denied, so normal launch was checked with approved outside-sandbox access. No global Git settings changed.

Checks not run: Linux/container build, containment/egress tests, model calls or vision, authentication, workbench authorization, votes, worker recovery or integration. Those features do not exist yet. Developer host execution is not the future safe runner. Actual Ctrl+C keyboard behavior of the revised launcher remains a manual check; its bounded automatic shutdown and no remaining preview processes were verified.

### Manual walkthrough (PowerShell only)

From C:\AI_employee:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario clean -Port 8080
```

Open http://127.0.0.1:8080. Expect four cards. Create Learn the task flow with any synthetic description; refresh and find it retained. Click Start task, Complete task, then Reopen task and observe the status cycle. To do shows only todo cards, In progress only in_progress cards; All tasks includes Completed cards. Remove asks for confirmation. Ctrl+C stops the launcher; restart the same command without ResetData to see retained data. The dedicated Completed filter is intentionally absent.

Use separate terminals for fixtures; ResetData replaces that scenario's synthetic rows, so stop its existing server first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario frontend -Port 8081 -ResetData
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario backend -Port 8082 -ResetData
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario feature -Port 8083 -ResetData
```

At 8081 use Chrome DevTools' device toolbar, set 390x844, scroll to cards; buttons intersect by 40px horizontally (1360 square pixels per card). At 1280x800 they do not. At 8082, To do incorrectly shows all four seed rows. At 8083, the existing filters work but Completed is missing; /api/tasks?status=done already returns exactly task 4. This confirms the feature is separate from the backend query defect.

Rerun checks or rebuild after source edits:

```powershell
node .\trusted_checks\phase1.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Playground.ps1
```

No WSL/bash command has been validated for this phase. All owned preview servers are stopped at handoff; start the desired one using the commands above.

### Limitations and next phase

No login or production access. Task status writes are serialized locally but there is no multi-user stale-write conflict UI. UI maxlength counts characters; backend bounds UTF-8 bytes (120 title, 1000 description), so long multibyte input may receive an explicit error. Source fixtures are developer controls, not worker capability. No repair, candidate acceptance, voting, queue scheduling or integration is claimed. Database reset/source rollback are separate actions. C++ toolchain portability and PostgreSQL credential scopes remain to verify.

Phase 2 will add synthetic employee login, submissions/screenshots, provisional deterministic priority, durable queue/history and notifications. It will use a separate protected control plane and PostgreSQL. Phase 3 remains gated on actual model access; Phase 4 on safe execution containment.

### Three interview questions and explanation outlines

1. Why prepared statements and RAII? Bind values separately from SQL syntax; statement/connection cleanup remains correct across success and exceptions.
2. What proves persistence rather than browser memory? API-created ID/title is observed after terminating and restarting the server on the same database; browser refresh separately reads a stored row.
3. Why keep checks and fixture setup outside playground? Repairs may edit playground source but cannot change trusted expectations or fixture authority to manufacture a passing result. Baseline failures remain recorded independently.

Exercise: with the clean server stopped, find the title byte limit in routes.cpp, explain how changing it differs from changing the HTML maxlength, and trace a rejected request before any INSERT. Alternatively reproduce the backend fixture and explain why its done API works even though the todo filter fails.

Learning checkpoint: review the actual app, confirm these fixture/acceptance definitions, and reply continue when ready. The explicit teaching pause in section 2 of DevDesk_Codex_Build_and_Learning_Instructions.md applies; do not start Phase 2 before continuation.

## Phase 1 deeper code review â€” 11 October 2026

At the user's request, Phase 2 remains paused while they learn the existing folders and code and make their own changes. docs/PHASE1_CODE_GUIDE.md now maps 905 physical lines across 19 application/tool/check/config/generated files and separately explains the backend SQL override and three frontend fixture additions. Blank/closing lines are accounted for. Imported dependency internals are described by their role/API boundary rather than individually annotated; binary artifacts and documentation have folder/file explanations.

Read-only source inspection confirmed clean playground Git status and the expected frontend/backend branch commits. The guide-generation check rejected unexplained executable lines and verified all common fixture app files match clean after newline normalization. The backend difference is exactly line 60's OR ?1 = 'todo'; frontend adds three CSS lines. No product source, database, fixture or build was changed; no new server/product test was run for this documentation work. Phase 1's existing 10 October evidence is preserved.

The guide contains a predicate truth table, direct PowerShell API reproduction, Chrome Network inspection, and instructions to create learning/backend-fix in var/exercises/backend-fix. Those commands have not been executed: the user can edit/build their own worktree and use an independent backend-learning.db on port 8084 while preserving the broken demo baseline. Default Build-Playground compiles clean; Source must point to the checkout actually edited. ResetData changes data only; edits need compilation, and frontend changes need a refreshed build/static snapshot.

The guide is human learning material with oracle expectations/manual diagnosis; do not feed it to the future repair model or expose it through scoped worker source tools. No repair mapping/tool has been introduced. The user subsequently authorized Phase 2 on 11 October 2026.

## Phase 2 â€” workbench and persistence, 11 October 2026

User authorized implementation. Pre-edit explanation covered the protected C++ workbench, PostgreSQL versus SQLite, dedicated local instance, transactional record flow, provisional policy, ownership/refresh/restart checks, and excluded worker/source-edit behavior. Full current folder/source/API/table guide, walkthrough, tradeoffs, interview questions and exercise: docs/PHASE2_WORKBENCH_GUIDE.md.

Important source: main.cpp/main owns startup; support.hpp/Result, Database, Transaction provide libpq RAII; support.cpp/password_hash and random_hex implement Windows CNG auth; image.cpp/decode_image uses full Windows WIC decoding; routes.cpp/authenticate, membership, install_routes own trusted identity/authority/validation/policy; static/app.js/api, session, refresh, detail and submission listener own browser interactions and request key reuse. Tools Setup-DevDeskPostgres, Build-Workbench, Start-Workbench and Setup-Phase2Test have distinct setup/build/lifecycle/test responsibilities.

Actual trace: Chrome authenticated Asha, uploaded the Phase 1 frontend screenshot, submitted cosmetic report JSON with an operation key, and received ticket #9 in the final fresh test schema. API authenticated session/CSRF/project, decoded/preserved screenshot, validated report, locked reporter row, then transactionally inserted request -> queued/unconfirmed investigation -> linked P3 QUEUED ticket -> submitted event -> acknowledgement. Commit preceded HTTP 201; the UI displayed original evidence and actual recorded event, without investigation/repair claims.

Final trusted run: 95 PASS/0 FAIL, 12.274 seconds, zero model calls. Exact report var/evidence/phase2-2026-10-11T08-06-58.042Z-2132/report.json and build 3241fad332872d032de0294d3ac40a49e694489973b146e1069c0f8c67429b72. Concurrent duplicate submissions across two API processes produced one effect; changed-payload replay returned 409; forced acknowledgement failure rolled back all linked records. Authorization, image validity/limits/ownership, role scopes, three concurrent distinct requests, deterministic queue order, withdrawal/history, notification privacy/read persistence, refresh/restart and actual Chrome/text/mobile behavior passed. Desktop/mobile PNGs were visually reviewed. Bounded normal launcher passed on 8094 and cleaned its owned child. Port 8090 is occupied by an unrelated process left running.

Observed failures/fixes: Windows sandbox denied PostgreSQL native startup; approved retry worked on dedicated 5433. Direct DLL linking caused MinGW runtime relocation failure; linking libpq.lib fixed it. A browser assertion raced async detail rendering; waiting on the element corrected the check. Interactive Ctrl+C, WSL/Linux portability, load testing, production auth and future model/worker/approval/repair/voting/integration were not verified. Phase 1 was unchanged and not rerun. Limitations include one serialized connection, process-local login throttle, orphan-image/session/test-schema retention, localhost HTTP and Windows-specific crypto/decoder.

Interview outlines: (1) transaction atomicity and why upload is separate, using the rollback evidence; (2) operation-key/payload-hash/row-lock/unique-constraint retry protection and private notification keys; (3) reported impact versus trusted observations/authority, explaining why unconfirmed data loss remains P2. Exercise: submit cosmetic then functional reports and explain priority sorting; change a provisional explanation in source, rebuild, then contrast old recorded versus new ticket explanations.

Commands and manual employee walkthrough are in the Phase 2 guide and README. Next: Phase 3 read-only model-selected investigation with actual source/browser/API observations; source changes still forbidden. Pause now for the user's learning checkpoint, per section 2 of the active blueprint. Reply continue to authorize Phase 3.

## Phase 3 current verification â€” 11 October 2026

User authorized Phase 3. Read-only C++ worker/provider, fixed scoped helper, immutable builds, migration and evidence UI are implemented. The pre-edit explanation covered purpose, files, flow, serialized-action tradeoff, tests and excluded repair authority. docs/PHASE3_INVESTIGATOR_GUIDE.md contains the full source/function map, trace, exact PowerShell walkthrough, tests/limits, three interview outlines, exercise and Phase 4 preview.

Latest build: 39c3249e44c6a52a1a58f6d401efd01675d2c76e55cf76b39d390e6fd99a0b82. Phase 3: 59 PASS/0 FAIL, 80.825 seconds, var/evidence/phase3-2026-10-11T11-51-28.926Z-43268/report.json. Phase 2 regression: 95 PASS/0 FAIL, 17.262 seconds, var/evidence/phase2-2026-10-11T11-51-29.156Z-42528/report.json. Decisions were explicitly scripted, zero live model calls. Real backend API failure, frontend Chrome overlap, source reads, authorization/policy denials, capacity, recovery record, notifications and trace rendering passed; existing fixture source/data were preserved.

Observed startup failures required native USERPROFILE for Chrome with a separate temporary browser profile. Windows refused overwriting the running user executable; builds now create immutable releases. A stale test HTTP connection was corrected in the driver. Actual crash during billed inference, live model/image/structured capabilities, Linux and repair isolation remain unverified. The local model key is empty; a nonbilling probe and one-report live test are prepared. Phase 3 is in progress, not complete; do not start Phase 4 before live verification and learning checkpoint. Existing user previews/PostgreSQL are preserved.

Gemini provider update: user selected gemini-3.5-flash-lite. Native Google generateContent requests use responseJsonSchema for one action, PNG/JPEG inline input and x-goog-api-key over fixed-host TLS. C++ policy checks remain authoritative. Gemini parser rejects incomplete/multiple candidates, unexpected model identity and inconsistent usage; non-input tokens conservatively include thinking. A GET models probe verifies generateContent support before inference. Configuration now selects provider gemini and rates $0.30 input/$2.50 output per million tokens (Google standard pricing); the $0.50 application estimate remains. Stable model aliases may evolve and are not immutable dated snapshots. OpenAI remains supported as an alternative. Live Gemini verification passed; the credential remains local and ignored. Official references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/pricing .

Gemini adapter verification: build 5e6b94964c67ff5703fdea0ad20ef767f8590c62e88194887cbdf07dced032a9 compiled successfully. C++ policy/provider self-checks: 14 PASS (five new Gemini checks). Full Phase 3 scripted suite: 59 PASS, 0 FAIL, 74.596 seconds, var/evidence/phase3-2026-10-11T12-35-16.943Z-69420/report.json. Live pilot JavaScript syntax check passed. The live probe stopped before networking because the Gemini key is empty; zero live model calls. Phase 2's last separate regression remains 95 PASS on the preceding build; it was not rerun for the provider-only change. Configure the Gemini key locally in var/config/model.json to finish live verification. Existing previews and fixture data are preserved.

Live Gemini access was confirmed with the configured local credential using GET models. First pilot var/evidence/phase3-live-2026-10-11T12-37-25.266Z-39504/report.json attempted one inference request, but transport failed after about 33 seconds. It retained NEEDS_INFORMATION and usage_complete=false; zero measured tokens/cost do not prove zero billing. No source was edited. A bounded fresh pilot uses a 90-second response timeout and safe numeric Windows transport diagnostics. No automatic replay of the uncertain request occurs. Updated live driver saves the redacted trace even when an assertion fails. Model capability/reproduction remains pending the fresh pilot result.

Second live pilot var/evidence/phase3-live-2026-10-11T12-43-56.775Z-102760/report.json received two real Gemini decisions: project_instructions succeeded; source_list carried forbidden evidence_ids and was correctly DENIED. It recorded 4,161 input tokens, 195 output tokens (including any thinking), estimated $0.001976 and complete received usage. This verifies live structured/image request transport and parsing, but not successful reproduction. Evidence is retained in redacted-trace.json. Field descriptions/prompt now explicitly require empty evidence_ids on every non-finish action, preserving the existing validator. A fresh pilot is prepared after rebuild.

Third live pilot var/evidence/phase3-live-2026-10-11T12-54-02.008Z-17212/report.json correctly denied source_list with start_line=0/limit=0. It received two decisions, 4,251 input and 161 output tokens, estimated $0.001958. Evidence-ID instructions worked; provider schema now also states existing line minimum/maximum bounds. Investigation prompt v2 makes non-finish argument rules explicit, and project context no longer suggests an unavailable comparison viewport. Runtime validators remain unchanged. Failed live records are retained and not promoted to reproduction.

Prompt-v2 live pilot var/evidence/phase3-live-2026-10-11T12-56-21.608Z-78644/report.json received four real decisions (12,011 input/541 output tokens, estimated $0.005670). Source retrieval succeeded, but Gemini claimed reproduction from CSS without browser/API observation. Trusted conclusion validation denied the unsupported claim. Prompt v3 prominently requires appropriate live observation and FAIL/PASS citation before assessing reproduction. No known patch or fixture outcome was supplied. Phase 3 scripted regression on v2 build remained 59 PASS/0 FAIL in 74.443 seconds, var/evidence/phase3-2026-10-11T12-56-39.862Z-90872/report.json. Actual-model claim failures are retained as limitations/evidence, not hidden successful investigations.

Live prompt-v3 pilot var/evidence/phase3-live-2026-10-11T12-58-35.383Z-63644/report.json selected real Chrome observation and measured 1,360 pixelsÂ² button intersection at 390x844. Gemini then attempted a conclusion without a source read; trusted validation denied it. Received usage: 7,444 input/343 output tokens, estimated $0.003526. Thus live image/structured request, model-selected browser observation and screenshot persistence are demonstrated, but the complete investigation gate had not passed. Prompt v4 uses decision_schema to omit finish until successful project context, source read and live assertions exist. This narrows model choices without changing tool execution permissions or bypassing conclusion validation. Three new self-checks cover prerequisite absence, partial prerequisites and eligibility. No expected fixture result or known repair is inserted.

Prompt-v4 pilot var/evidence/phase3-live-2026-10-11T13-00-48.741Z-13156/report.json correctly denied browser_observe carrying a source path (three calls, 7,121 input/263 output tokens, estimated $0.003269). The flat schema's irrelevant-field defaults were unreliable with this model. Gemini now receives tool-specific anyOf variants inside one action envelope: unused string fields are constrained to empty, non-finish citations to zero items, and finish is unavailable before prerequisites. Budget reservations include the larger actual Gemini schema. Three new checks cover branch count and browser/finish argument restrictions. This is generic contract enforcement, not fixture diagnosis or a repair mapping; C++ validation remains authoritative. Earlier failed live evidence and unknown first-request billing remain retained.

## Final Phase 3 verification â€” 11 October 2026

Implementation and live verification are complete; pause at the learning checkpoint. Build 070f5268e483b7889cfe1327737d8076fc1f500cb9745e54778c826991226a8a, investigation-v4, Gemini gemini-3.5-flash-lite. Final live report var/evidence/phase3-live-2026-10-11T13-15-55.785Z-87240/report.json: 8 PASS/0 FAIL, 36.266 seconds. Six model decisions: project instructions -> source list -> static/styles.css read -> API observation -> Chrome observation -> evidence-cited reproduced conclusion. Browser measured 1,360 pixelsÂ² overlap at 390x844; screenshot was saved and visually inspected. Source/data identity stayed unchanged. Run FINISHED; ticket INVESTIGATED_READ_ONLY, never COMPLETED. No source edit/approval/repair/integration occurred.

Live usage: 25,165 input and 679 output tokens (conservative thinking-inclusive count), estimated $0.011152 for the successful run. Earlier pilot receipts total an additional $0.016399 estimated; the first timed-out request's billing is unknown, so the complete session total is not established. Stable model alias is not an immutable dated snapshot. Accepted screenshot requests demonstrate input transport, not a visual reasoning benchmark. Failures exposed schema/prompt weaknesses; typed tool variants and prerequisite schema gating fixed the demonstrated path without bypassing policy.

Final same-build checks: 20 C++ self-checks PASS; Phase 3 scripted report var/evidence/phase3-2026-10-11T13-16-13.258Z-41412/report.json: 59 PASS/0 FAIL, 80.488 seconds; Phase 2 regression var/evidence/phase2-2026-10-11T13-16-13.656Z-98936/report.json: 95 PASS/0 FAIL, 20.790 seconds. Test servers were cleaned by their launchers; existing user workbench PID 115708 and frontend PID 21624 remain running. Existing PostgreSQL was preserved. Native HTTPS required approved execution outside the tool sandbox. No credential was printed.

Full map, commands, trace, manual walkthrough, three interview questions and learning exercise are in docs/PHASE3_INVESTIGATOR_GUIDE.md. The final live schema/tool changes were retested; repeated tests are now unnecessary absent a new change. Unverified: broad model reliability, live backend/feature scenarios, actual crash during billed inference, interactive Ctrl+C, Linux portability and arbitrary-code isolation. Scripted recovery used an abandoned record. Phase 4 must demonstrate repair isolation before any model-edited code execution and add explicit source-change approval. Do not interpret this read-only success as permission to edit source; wait for the user's continuation after learning.


## Phase 4 implementation and execution blocker — 11 October 2026

Final build 26da9c868f76f2aac19566e575003180a023e47ab0331ba84c7bb3d2dc21b545 adds reporter-only bound scope approval, detached CSS patch tools, frozen repair prompt/helper, independent container evaluator, persisted repair trace/UI and explicit patch-only fallback. Normal repair cannot claim a ticket before containment verification. Final checks: 21 authorization PASS, 59 investigator regression PASS, 95 workbench regression PASS. See docs/PHASE4_REPAIR_GUIDE.md for exact reports, contracts, commands, walkthrough and exercises.

Docker initially reported a Linux engine, then API requests failed with HTTP 500/absent pipe. User confirms engine startup says waiting for the Docker API: context deadline exceeded. Approved Docker Desktop restart timed out stopping com.docker.build.exe. No reset, image deletion or host execution of model-edited code occurred. Runner image/probes/Linux checks/verified candidate remain unrun. Phase 4 remains incomplete; no Phase 5 advance or completion claim.

Two fresh live investigation pilots failed safely (repeated context action, then empty source path). A direct patch-only pilot exposed a double-unwrapped helper JSON result; fixed and rebuilt, final regressions passed. A new approved synthetic test ticket, independently reproduced with actual browser tools through the scripted adapter, then received real Gemini repair decisions. Eight fallback audit checks PASS. Three repair calls, 7719 input/381 output tokens, $0.003697 estimated received usage. A CSS diff is preserved in a detached checkout; state PATCH_ONLY, ticket REPAIR_BLOCKED, no candidate commit and no build/check execution. This is not an end-to-end verified live repair. Failed traces remain retained; total session billing differs from that successful-run estimate.

Original workbench PID115708 and frontend PID21624 remain running; existing PostgreSQL and shared fixture source are preserved. Section 8 of the blueprint requires genuine isolation. Remaining work is restore Docker's API, build pinned runner, prove containment/timeout/baseline and execute a real model-driven candidate loop before the Phase 4 learning checkpoint.

## Phase 4 final Docker and candidate verification

Docker's restarted engine now responds: 28.1.1 Linux. The runner dependency-install retry succeeded; pinned image sha256:71bd8c25f99323826f76ca55f93ca41ed7f378e7c25483b910fe9ca74f402231. Actual probes exposed two runner issues: Docker archive-copy did not expose live tmpfs artifacts, and default tmpfs noexec prevented the compiled application from starting. Corrected fixed bounded artifact export and enabled execution only in container temporary storage; all containment settings remain. Added real browser create/advance/remove checks at both viewports, source digests and before-patch checkpoints with failed-check rollback. Failed reports are retained.

Final immutable build 974824f7c9aaf71ddd2008967f6d899faeb3381a5a7c1b4a2b0dfce669f7004c. Ten isolation checks PASS: eight containment probes, timeout-stop and baseline conformity (19 PASS, intended mobile geometry FAIL). Five rollback checks PASS. Final auth20 PASS; conditional unavailable-runner gate previously passed in auth21 before verification. Same-build Phase2 95 PASS and Phase3 59 PASS. Full live pilot var/evidence/phase4-live-2026-10-11T18-18-21.587Z-1932/report.json: 11 PASS. Real investigator five calls, real repair six calls; one model-generated CSS patch. Candidate assertions20 PASS including browser clicks, two viewports, filters and task operations. Authenticated screenshots and unauthenticated denial passed; final mobile/desktop images were visually inspected.

Candidate4945512e8e8d07ca6901a1581bc1363d2cbc7254 in var/workspaces/1c4435ba957817f9a1d4ce17813bf58f. Base/shared source remains4c0e6bab2605378fbbb33f82b1fd37e7bb458ed0. TicketCANDIDATE_READY, notCOMPLETED. Successful investigation estimate$0.007426 plus repair$0.010571=$0.017997, complete received receipts; earlier pilots/unknown billing remain additional. No shared integration or host execution of model-edited code. No Phase4 containers remain running. Dedicated PostgreSQL and frontend were stopped in the restarted environment; restarted preserving existing data. Frontend preview is bounded to1800 seconds. Test servers cleaned up; database preserved.

Phase4 implementation and demonstration are complete. Learning guide docs/PHASE4_REPAIR_GUIDE.md contains actual trace, maps/functions/contracts, commands, before/after evidence, unverified limitations, three interview prompts and exercise. Pause at learning checkpoint before Phase5 requester acceptance/integration. General model reliability, arbitrary-backend evaluator separation, repair crash recovery and interactive Ctrl+C remain unverified.

## Phase 5 verification — 12 October 2026 (IST)

Resumed after the user started Docker. Interrupted build had completed: immutable backend20c2d0bc48333e48ad2741653f863dfcaadcfe5b3b4a2626fd77725cb8015b09. Dedicated PostgreSQL was stopped; restarted its existing data directory. Setup-DevDeskPostgres.ps1 and Build-Workbench.ps1 were missing during resume and restored; existing database/migration ledger/configuration were preserved. Existing-cluster setup and selection of the matching release passed. Fresh-machine bootstrap/cold rebuild remain unverified.

Actual Phase4 candidate4945512e8e8d07ca6901a1581bc1363d2cbc7254 was continued in fresh synthetic acceptance schemas. Phase5 main suite23 PASS0FAIL; integrated assertions20 PASS0FAIL. Reporter controls, rejection, binding/expiry/changed/unknown evidence, duplicate decisions, global guarded integration, completed history and persisted notification passed. Integration5ccec08da5757a15976c94164dc94ebe. Shared frontend source now at the candidate; manual reports/task data preserved. Main report var/evidence/phase5-2026-10-12T02-44-21.225Z-28452/report.json. No new inference calls; actual model source was the existing live Gemini candidate.

Additional: stale-base4 PASS, actual Chrome history5 PASS, current DevDesk regression95 PASS. Investigator pre-integration baseline57 PASS; conditional preservation checks absent when test owned its fixture. Continuous launcher bounded test: three polling cycles/nine child runs in six seconds, clean shutdown and read-only model-access GET. This is a terminal poller, not a Windows service. No background startup task installed.

Private Git rollback tests hit ownership configuration and later Docker API HTTP500. Earlier failure receipts retained. Prepared private clone then explicitly injected Docker-create failure using a test-only Node import seam; unchanged frozen helper executed real Git mutation and rollback, restoring prior CSS with new commit7462cf6e30d660476e6258c864dc37267465ede7. Five audit checks PASS, real shared source untouched. Initial CRLF-sensitive assertion failed; read-only audit compared normalized content plus exact Git blobs, without replaying mutation. This fault test did not run a real container; a real bad-CSS post-merge rollback retest remains unverified due Docker failure. The earlier successful integration's twenty real checks remain valid.

Phase5 core source workflow and single-bug demonstration complete. Guide docs/PHASE5_ACCEPTANCE_GUIDE.md contains map/functions/contracts, exact trace and reports, startup/manual walkthrough, limits, three interview prompts and exercise. Pause at learning checkpoint before Phase6. Existing native preview snapshots are not redeployed automatically and do not match advanced source; do not bypass identity checks or host-build edited app code. Preview activation, crash gaps/leases/fencing, active cancellation, accepted-decision expiry renewal, concurrent external effects and interactive Ctrl+C remain future work. Current Docker HTTP500 blocks new runtime executions.

## Phase 6: reliability learning checkpoint

Implemented single-project leases with heartbeat and fences, Windows ownership handles, helper effect guards, cancellation acknowledgement, explicit reinvestigation, scope/acceptance expiry, interrupted-operation reconciliation and next eligible repair selection. Fixed isolated preview activation: accepted source builds inside Docker, internal-network app and separate mount-free trusted ingress relay. No GitHub connection, service installation or Phase7 backend edit.

Final evidence: 27 reliability PASS; 5 integration recovery PASS; 4 actual GET-function transport-seam PASS; 10 real runtime prerequisites including all20 app assertions PASS; 10 live preview Chrome/API PASS; final-release workbench regression95 PASS. Real lease-holder process was killed. Interrupted run/integration states were seeded explicitly. Real Phase5 verified journal recovered completion without Git writes; missing journal blocked. Bounded launcher3cycles11children reused preview in a fresh empty schema; no new inference requests. All exact paths and retained failures are in BUILD_STATUS.md.

Errors corrected include missing submission key, test capacity contention, null missing-journal receipt and Docker network-message differences. Direct internal-network ingress failed on this Windows engine, so trusted relay ingress was added and checked; editable application remains isolated from host execution. Original source accepted commit and original task database preserved. Current preview runs have a30-minute bound; continuous launcher keeps healthy preview available and processes eligible work while its terminal remains open.

Read docs/PHASE6_RELIABILITY_GUIDE.md for the ownership contract, safe-boundary cancellation, why ambiguous provider calls cannot be replayed, exact journal recovery, UI manual walkthrough, three interview questions and a scope-expiry exercise. Pause at this learning checkpoint. Next phase: reuse runtime for the backend defect with genuinely independent output checks. Future GitHub reporter-review/admin-merge requirements are recorded in SPEC.md but not implemented.

## Phase 7: backend reuse learning checkpoint

The backend capability reuses the same investigation, reporter scope approval, bounded patch loop, exact candidate acceptance, integration and recovery state machine. Key pointers: repair_profile.hpp/repair-profile.mjs for profile and function boundaries; repair.cpp/model.cpp for typed action contracts; integration.cpp/reliability.cpp for exact profile/hash binding; backend-checks.mjs/db-read.cpp/check.mjs for independent SQLite expectations and separated evaluator/app identities. Migration007 persists profiles; preview helper activates both accepted fixtures. No production repair table or hard-coded SQL patch selector was added.

Actual trace: read-only run6b2e74b8e8913705efd7086cb7390fe9 reproduced API filter failures; synthetic Asha approved scope; repair9203284ddccfbc1da8d68f437cd35c75 received Gemini's SQL replacement and all26 candidate checks passed; Asha accepted exactcommit0ea464b86c4005c99c5e600bdd7da98bd0aa03f5; integration07cea189ea2bbc8d797d143237f2d6ac passed26 independent post-merge checks then COMPLETED/history. Real-model driver13 PASS. Completed demo lives in a separate fresh schema, not the main manual-workbench queue. Successful10 received inferences estimated$0.012053; known receipts across25 decisions estimated$0.027349 plus one request with unknown billing. No all-session billing claim.

Core explanation: the old SQL OR ?1='todo' is true for every row when the requested filter is todo. With done it is false and the status=?1 predicate works. The actual model patch removes that extra disjunct while retaining bound parameters and Statement RAII. Independent checks compare API to real SQLite rows after dynamic mutations, so fixed seed answers cannot substitute for a working query. Protected evaluator UID10002 and appUID10001 demonstrate direct result-file/process isolation; application execution stays inside Docker.

Retained failures taught why immutable tool choices should disappear after success, why backend conclusions require relevant API evidence, and why canonical LF model text needs exact newline-aware patch matching against physical CRLF bytes. Unknown provider usage remains unknown; failed patch attempts do not become candidates. Conservative function-boundary text checks deny broader edits but do not constitute full C++ parsing. Docker's intermittent API/registry issues required verified local image reuse, not host execution or TLS weakening.

Final checks: backend runtime14, frontend runtime10, backend preview11, frontend preview10, review10 and history5 PASS; archival authorization18, policy7, adapter3, backend/frontend journal recovery5 each, reliability27 and workbench95 PASS. Final native offline checks22+8+4 PASS. Guide and BUILD_STATUS retain exact reports, differing successful-live/final build versions, limitations and unverified crash/exploit scenarios. Shared fixtures clean, original data preserved; both accepted previews active. Worker terminal must remain open.

Read docs/PHASE7_BACKEND_GUIDE.md: file/symbol map, SQL truth table, exact workflow, manual completed-demo instructions, failures and costs, three interview questions and exercise. Exercise: derive filter IDs before/after, inspect baseline failure assertions, identify the independent mutation check and unchanged RAII/binding. Pause here. Next phase introduces snapshot roster, unique eligible votes, deadline and ceil(2N/3) feature consensus before the shared repair path; Phase8 has not started. Requested GitHub contributor/reporter-review/admin-merge synchronization remains future work.

## Phase 8: feature consensus learning checkpoint

Implemented C++ consensus module, migration008, snapshot roster and immutable votes. open_feature_poll binds published scope plus members/deadline; cast_feature_vote locks/validates a unique authenticated choice; reconcile_poll applies integer ceil(2N/3), impossibility and deadline; require_feature_consensus protects repair, candidate decision, integration and recovery. Files: consensus.cpp/hpp, routes.cpp, static/app.js, repair_profile.hpp/repair-profile.mjs, repair.cpp/integration.cpp/reliability.cpp, fixed runner and preview helpers. Runtime DB grants prevent snapshot/vote/goal mutation. Existing filter navigation is the only editable feature scope; no known production patch map.

Actual trace: Asha's Completed-filter request was independently observed by Gemini in run cf89d9422a6b935d271bef240e8cea70. Synthetic exact scope approval plus Asha/Ravi/Maya YES votes met3of4. Repair388b7faab6af6ecc1fee0840acfb4140 generated HTML candidateb8509a4cb64bc19be911d0a5800d0e88aa29cc2c and22 PASS. Requester exact acceptance preceded integrationb04da9bc612b12f3e14de3d216624286,22 post-integration PASS and COMPLETED/history. Driver15 PASS; five investigation and five repair calls, estimated$0.011157 with complete received receipts. Main reports and other source fixtures preserved. Provider remains Gemini gemini-3.5-flash-lite alias.

Voting tests44 PASS; review/concurrent votes14 PASS; feature journal recovery7 PASS; history5 PASS; frontend/backend/feature final runtime10/14/10 PASS, app assertions20/26/22. Three final previews pass10/11/11. Existing workbench95 and reliability27 passed before final targeted guards/wording, which were separately checked. All exact paths/build distinctions are in BUILD_STATUS and the guide. Scripted contract fixtures are explicitly separate from real inference; crash database records are seeded, not a universal crash-point experiment. Current native offline checks22+8+4 PASS. No host execution of edited apps.

Failures retained: CRLF edit utility, test contention with the live project lease, testing review before runner verification, and a UI test incorrectly counting the baseline image among the two candidate images. Policy held; corrected scheduling/selectors and passing reruns are retained. Independent receipt metadata is bound to current image/clean heads instead of copying old verification flags.

Tradeoff: one reviewed feature capability is small enough to evaluate independently. Existing JS/API already support the done filter, so Gemini needed an HTML navigation addition only. Consensus does not replace reporter scope permission or final candidate acceptance; neither voting nor a model statement can produce COMPLETED without integrated checks. Poll deadlines need the running worker recovery cycle; a stopped launcher is not a background service. Current Git integration remains local, with requested GitHub contributor/reporter/admin flow still future work.

Guide docs/PHASE8_FEATURE_GUIDE.md provides functions/contracts, trace, manual open-poll/completed-demo walkthrough, limits, interview questions and exercise. Explain N4→3/N5→4 with rounding; reason through N5 threeYES/twoabsent, threeYES/twoNO, fourYES/oneabsent; locate unique vote key and identify why a new scope needs a new poll. Pause at this learning checkpoint. Next Phase9: packaging, reproducible setup, critical scenarios, truthful AI/model/service disclosure, demo and interview practice. Phase9 has not started.

## Phase 9: packaging and ownership checkpoint

Replaced historical README with current startup/workflow/source map/evidence and preserved old text in docs/README_HISTORY.md. Added SETUP_AND_DEMO, DISCLOSURES_AND_LIMITS, VERIFICATION_MATRIX, INTERVIEW_AND_DEBUGGING and PHASE9_PACKAGING_GUIDE. Source package uses Package-DevDesk.mjs explicit allowlist, selected Git bundle refs, manifest/ZIP hashes and assertion-only extracts. Restore-PackagedFixtures.ps1 restores accepted or fresh original-baseline commits and preserves existing worktrees. verify-runner.mjs verifies profiles on a fresh package without historical local metadata. No C++ application behavior changed, new inference, publication, video or GitHub connection.

Actual package trace: exported main/fixture refs and clean tag; extracted ZIP into a private evidence directory; checked file hashes and known local secret absence including Git object contents; restored three exact accepted commits, reran baseline restore to prove preservation, then restored three original commits in a fresh extraction. Original root fixtures/data preserved. Package verification15 PASS; final pointer var/evidence/phase9-package-latest.json binds report and ZIP checksum. No application execution or second database cluster in extracted-package test.

Current suite27 PASS includes15 historical report validations, offline policy checks, current Workbench95/reliability27, bounded documented startup on8110 and source/data preservation. Exact report var/evidence/phase9-1791819003296/report.json. The underlying95/27 assertions are not additional model trials. Current generic frontend10/backend14 runner checks passed; feature verification and final archive are recorded in BUILD_STATUS. No new model calls or receipts.

Retained setup failures: DockerHTTP500 stopped the initial generic command; user restarted the engine and the same command passed. Initial archive helper hit local PowerShell execution policy; process-local Bypass now matches the existing documented launcher approach without changing machine policy. Explicit dependency-path assumptions and clean external-machine provisioning remain disclosed rather than claimed as tested.

Interview practice: explain source history versus binaries, digest identity versus behavioral correctness, separate edit/merge permissions and current bootstrap proof versus external prerequisites. Hands-on exercises cover priority, read tools, stale approvals, browser evidence, duplicate effects/recovery, worker restart, private threshold experiments and future GitHub mapping. Use the actual Phase8 trace through scope/poll/repair/review/integration; preserve accepted sources. All implementation phases are packaged locally; final learning checkpoint remains user-owned. Public source URL/video and future GitHub PR/admin synchronization require separate authorized work.
