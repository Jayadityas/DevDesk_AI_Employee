# DevDesk build workspace

Current implementation: Phase 8 adds feature voting with a fixed member snapshot, authenticated immutable votes, `ceil(2N/3)` approval, deadlines and INVALID history. Both consensus and reporter scope approval precede implementation; exact candidate acceptance and passing integrated checks precede COMPLETED. Real Gemini added the Completed filter to the feature fixture and passed all 22 candidate/integrated assertions. Read the [Phase 8 feature guide](docs/PHASE8_FEATURE_GUIDE.md) for scope, evidence, source map, demo and learning checkpoint. Accepted Docker previews: frontend8081, backend8082, feature8083. Start the workbench with `tools/Start-Workbench.ps1` (8094) and `tools/Start-Workers.ps1` in separate terminals; keep both open and restart old workers for the new release. Main manual reports were preserved; the completed feature demo uses a separate test schema. Current feature implementation is limited to the Completed-filter capability. GitHub PR integration and Phase 9 packaging remain future work. Earlier phase descriptions below are historical.


Phases 1 and 2 implement the Team Tasks playground and authenticated DevDesk workbench. Phase 3 adds a C++ read-only investigator, provider adapter and persisted evidence; live Gemini investigation is verified. The user-selected language is C++20, with HTML/CSS/JavaScript UI and JavaScript Playwright checks.

Read [the Phase 3 investigator guide](docs/PHASE3_INVESTIGATOR_GUIDE.md) and [Phase 4 repair guide](docs/PHASE4_REPAIR_GUIDE.md) for investigation and repair. [The Phase 5 acceptance guide](docs/PHASE5_ACCEPTANCE_GUIDE.md) explains requester acceptance/rejection, guarded integration, completed history and one continuous worker launcher. The real Gemini frontend candidate was integrated into shared source and passed all 20 post-integration assertions. The synthetic demonstration ticket completed; manual reports were preserved. Existing preview builds are not automatically redeployed. Credentials stay in ignored local configuration. Voting and crash recovery remain later work.

## Workbench â€” Phase 2

Read [the Phase 2 workbench guide](docs/PHASE2_WORKBENCH_GUIDE.md) for the folder structure, database records, security boundaries, actual request trace, walkthrough, checks, limitations and exercises. PostgreSQL 17.11 is installed under C:\Program Files\PostgreSQL\17; the dedicated DevDesk cluster uses port 5433 and restricted runtime credentials in ignored local files. The existing server on 5432 is not configured by our setup.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
```

Open http://127.0.0.1:8094. Open var/config/demo-accounts.json locally for synthetic passwords; do not share credentials or whole evidence directories. Use asha/ravi/maya/noah for Team Tasks; outsider has no project membership. Reports start awaiting investigation. Approved repairs can produce a candidate; requester acceptance permits source integration, and successful post-integration checks record completion/history/notification. Start the continuous workers in a separate terminal with `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1`. This polls while the terminal stays open; no automatic Windows startup is installed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Workbench.ps1
node .\trusted_checks\phase2.mjs
```

Checks need the dedicated database running, create fresh test schemas, and preserve manual demo records. Final observed run: 95 PASS/0 FAIL, 12.274 seconds, zero model calls; pointer var/evidence/phase2-latest.json. Launcher defaults to 8094 because an unrelated process occupies 8090. Use -Port for another port and -Build after source edits. Ctrl+C owns workbench child cleanup; the bounded RunForSeconds path was verified. The initial migration is idempotent; future schema changes will need explicit migrations.

For the folder map, every authored code line, request trace, SQL truth table and isolated hands-on debugging exercise, read [the Phase 1 code guide](docs/PHASE1_CODE_GUIDE.md). This is human learning material containing expected results and a manual fix explanation; it must remain outside the future repair model's context and writable source scope.

## Requirements observed on this machine

Windows PowerShell, MSYS2 UCRT64 g++ at C:\msys64\ucrt64\bin\g++.exe with SQLite header/library/runtime, Git, Node/npm, installed Google Chrome, and PostgreSQL 17 header/import library/runtime for Phase 2. HTTP/JSON headers are vendored independently under playground/third_party and devdesk/third_party with licenses. tools/package-lock.json pins browser tooling. No Python or extra browser download is required. Workbench authentication/image decoding currently use Windows CNG/WIC; Linux portability has not been tested.

## Run in PowerShell

From C:\AI_employee:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario clean -Port 8080
```

Open http://127.0.0.1:8080. Create a task, refresh, and see it retained. Start task advances To do -> In progress -> Completed -> To do. Remove task asks for confirmation. All tasks includes completed tasks, but the dedicated Completed filter is intentionally absent for the later feature scenario.

Ctrl+C stops this server. Start the same command again without ResetData to check restart persistence. Build only when code changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Playground.ps1
```

## Developer fixture controls

After Phase 5, frontend source contains the accepted fix. Its earlier native build snapshot remains the original overlap fixture; preview activation is not automated. Historical fixture observations below describe that snapshot. Do not reset accepted source or host-build the model-edited app to bypass the isolation requirements; see the Phase 5 guide for the current boundary.

Initial fixture worktrees are already created. On a new prepared checkout, run Initialize-Fixtures.ps1 after the clean baseline tag exists. Re-running preserves existing worktrees and never silently discards source edits.

Stop the scenario's server before resetting. **ResetData replaces only that scenario's synthetic tasks.** Each scenario has a separate var/data database and source worktree. It does not repair/reset source or affect the other scenarios.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario frontend -Port 8081 -ResetData
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario backend -Port 8082 -ResetData
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario feature -Port 8083 -ResetData
```

Use separate terminals for simultaneous servers; each stops with Ctrl+C. These are local developer controls, not workbench actions or worker tools. No publicly reachable reset endpoint exists.

- Frontend: open http://127.0.0.1:8081, use Chrome DevTools device toolbar with a 390x844 viewport, scroll to task cards. Action buttons intersect. At 1280x800 they do not. Both controls remain present and clickable in the tested fixture.
- Backend: open http://127.0.0.1:8082, click To do. It incorrectly shows all four seeded tasks, including In progress and Completed. The clean baseline shows exactly tasks 1 and 2. GET /api/tasks?status=todo independently exposes the same error.
- Feature: open http://127.0.0.1:8083. To do and In progress filters work. There is no Completed option. GET /api/tasks?status=done already returns task 4; adding the missing UI filter is distinct from fixing the backend defect.

## Independent Phase 1 checks

```powershell
npm.cmd --prefix .\tools ci
node .\trusted_checks\phase1.mjs
```

Checks launch their own servers on dynamic local ports and use fresh databases under var/evidence, separate from manual data. Installed Chrome runs headlessly. Evidence includes JSON assertions, exact commit/build metadata and full-page screenshots at 390x844 and 1280x800. var/evidence/latest.json points to the latest report. Actual baseline FAIL assertions remain FAIL; the suite separately verifies that only the deliberate defects and the absent feature fail.

No model calls occur in these checks. They validate developer-authored code; they do not demonstrate safe execution of model-edited code. A future repair runner must use evaluated isolation before executing edited source. Trusted checks/tools are outside the separate playground Git repository.

## Important source paths

- playground/src/main.cpp: command-line setup, local server, seed-only mode.
- playground/src/routes.cpp: typed HTTP field validation and API handlers.
- playground/src/task_repository.cpp: SQL, transactions, RAII statements and persistence.
- playground/static/app.js: fetch, safe DOM rendering, create/filter/status/remove interactions.
- playground/static/styles.css: responsive card/action layout.
- tools/Build-Playground.ps1: local C++ build and source identity; not a sandbox.
- playground/build/static: assets copied at build time, so later source edits cannot silently change a preview tied to older build metadata. Rebuild to see source changes.
- tools/Initialize-Fixtures.ps1: creates defect baselines; contains no repair tool.
- trusted_checks/phase1.mjs: independent observable expectations; protected from future repair edits.

Playground limits: synthetic local data, no playground login or multi-user stale-write UI; SQLite is playground-only. The separate workbench has synthetic login/persistence and read-only worker evidence, but no approvals/voting/repair/integration. Safe runner setup remains unresolved. UI maxlength is character-based while backend limits are UTF-8 bytes (playground: 120 title, 1000 description). Do not submit production or private data.

AI assistance disclosure: Codex generated the current implementation, checks and documentation. All claimed results must be tied to actual run evidence; no live autonomous repair is claimed.

Gemini provider update: user selected gemini-3.5-flash-lite. Native Google generateContent requests use responseJsonSchema for one action, PNG/JPEG inline input and x-goog-api-key over fixed-host TLS. C++ policy checks remain authoritative. Gemini parser rejects incomplete/multiple candidates, unexpected model identity and inconsistent usage; non-input tokens conservatively include thinking. A GET models probe verifies generateContent support before inference. Configuration now selects provider gemini and rates $0.30 input/$2.50 output per million tokens (Google standard pricing); the $0.50 application estimate remains. Stable model aliases may evolve and are not immutable dated snapshots. OpenAI remains supported as an alternative. Live Gemini verification passed; the credential remains local and ignored. Official references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/pricing .



## Final Phase 3 verification — 11 October 2026

Implementation and live verification are complete; pause at the learning checkpoint. Build 070f5268e483b7889cfe1327737d8076fc1f500cb9745e54778c826991226a8a, investigation-v4, Gemini gemini-3.5-flash-lite. Final live report var/evidence/phase3-live-2026-10-11T13-15-55.785Z-87240/report.json: 8 PASS/0 FAIL, 36.266 seconds. Six model decisions: project instructions -> source list -> static/styles.css read -> API observation -> Chrome observation -> evidence-cited reproduced conclusion. Browser measured 1,360 pixels² overlap at 390x844; screenshot was saved and visually inspected. Source/data identity stayed unchanged. Run FINISHED; ticket INVESTIGATED_READ_ONLY, never COMPLETED. No source edit/approval/repair/integration occurred.

Live usage: 25,165 input and 679 output tokens (conservative thinking-inclusive count), estimated $0.011152 for the successful run. Earlier pilot receipts total an additional $0.016399 estimated; the first timed-out request's billing is unknown, so the complete session total is not established. Stable model alias is not an immutable dated snapshot. Accepted screenshot requests demonstrate input transport, not a visual reasoning benchmark. Failures exposed schema/prompt weaknesses; typed tool variants and prerequisite schema gating fixed the demonstrated path without bypassing policy.

Final same-build checks: 20 C++ self-checks PASS; Phase 3 scripted report var/evidence/phase3-2026-10-11T13-16-13.258Z-41412/report.json: 59 PASS/0 FAIL, 80.488 seconds; Phase 2 regression var/evidence/phase2-2026-10-11T13-16-13.656Z-98936/report.json: 95 PASS/0 FAIL, 20.790 seconds. Test servers were cleaned by their launchers; existing user workbench PID 115708 and frontend PID 21624 remain running. Existing PostgreSQL was preserved. Native HTTPS required approved execution outside the tool sandbox. No credential was printed.

Full map, commands, trace, manual walkthrough, three interview questions and learning exercise are in docs/PHASE3_INVESTIGATOR_GUIDE.md. The final live schema/tool changes were retested; repeated tests are now unnecessary absent a new change. Unverified: broad model reliability, live backend/feature scenarios, actual crash during billed inference, interactive Ctrl+C, Linux portability and arbitrary-code isolation. Scripted recovery used an abandoned record. Phase 4 must demonstrate repair isolation before any model-edited code execution and add explicit source-change approval. Do not interpret this read-only success as permission to edit source; wait for the user's continuation after learning.

