# Phase 7: backend repair through the shared workflow

Phase 7 is implemented and the live Gemini backend repair completed. This guide is learning material, outside the repair model's source context. The control plane remains C++20. JavaScript supplies fixed tooling, browser checks and the existing UI; SQLite stores playground tasks and PostgreSQL stores DevDesk workflow records.

## What changed

The frontend and backend now use registered repair profiles within the same investigation, scope approval, repair, candidate acceptance, integration and recovery machinery. A backend report at localhost:8082 selects the backend profile. It does not select a prewritten repair. The model reads source and live evidence, chooses a patch, and runs protected checks.

The backend profile allows changes only inside `TaskRepository::list_tasks` in `src/task_repository.cpp`. Changing its signature, adjacent functions, constructor, seed or database schema is denied. The frontend profile still allows only `static/styles.css`. Candidate and integration records snapshot the profile, authorization and exact file digest so a frontend permission cannot become a backend permission.

Backend preview: http://127.0.0.1:8082. Frontend preview: http://127.0.0.1:8081. Workbench: http://127.0.0.1:8094. Preview activation now handles both profiles using separate owned container/network pairs and data copies. Workers still run while their launcher terminal is open; no Windows background service is installed.

## Why the original filter failed

The seeded backend SQL contained:

```sql
WHERE (?1 = '' OR status = ?1 OR ?1 = 'todo') ORDER BY id;
```

`?1` is a bound parameter containing the requested filter. The last condition compares the requested filter to the constant `todo`; it does not compare a row's status. For a To do request it is true for every row, so SQL returns all four seed tasks. For a Done request it is false, leaving the correct row comparison.

| Requested filter | `?1 = ''` | `?1 = 'todo'` | Result before repair |
| --- | --- | --- | --- |
| Empty | True | False | All rows, intended |
| todo | False | True | All rows, incorrect |
| done | False | False | Only rows where status = done, correct |
| in_progress | False | False | Only matching rows, correct |

Gemini's actual candidate removed the extra disjunct:

```sql
WHERE (?1 = '' OR status = ?1) ORDER BY id;
```

The parameter binding and `Statement` RAII cleanup remain: the statement owns its prepared SQLite resource, binds the parameter, reads rows, and finalizes the statement when its scope ends, including exceptions. Neither seeds nor storage format changed. After repair, To do returns IDs 1 and 2; Done returns ID 4. This explanation follows the actual diff and independent checks rather than relying on the model's prose summary.

## File and symbol map

| File | Responsibility and reason |
| --- | --- |
| `devdesk/db/007_backend_profile.sql` | Adds constrained profile columns to scope proposals, repair runs and integration runs. Old rows default to frontend; migrations preserve existing records. |
| `devdesk/src/repair_profile.hpp` | C++ profile registry, allowed source path, expected relevant baseline failure, mandatory assertion names. |
| `tools/repair-profile.mjs` | Protected helper registry and `assertBackendScope`. Rejects edits outside the approved function before writing and again before committing/integrating. |
| `devdesk/src/routes.cpp` | Reporter scope approval, candidate decisions and detail responses retain the exact profile, files, hashes, ownership and expiry checks. |
| `devdesk/src/worker.cpp` | Read-only investigation records evidence; backend reproduction requires actual failing API filter assertions. |
| `devdesk/src/model.cpp` and investigation prompt | Tool-specific model schemas. Successful immutable instruction/list actions disappear from later choices. Backend finish requires API observation plus existing context/source prerequisites. Prompt version is investigation-v6. |
| `devdesk/src/repair.cpp` | Claims eligible approved work, binds the profile, creates an isolated workspace, drives model-selected read/patch/check/finish actions, and verifies all mandatory results before candidate publication. |
| `devdesk/src/integration.cpp` | Binds requester acceptance to exact candidate/profile/scope/check evidence, integrates a clean matching base, and requires independent post-integration verification. |
| `devdesk/src/reliability.cpp` | Reconciles profile-bound journals, invalidates stale authority and activates both previews under project ownership. |
| `tools/repair-helper.mjs` | Fixed Git/editor/container effects, file and function restrictions, checkpoint restoration, digest verification and exact candidate inspection. |
| `devdesk/runner/runtime-build.mjs` | Fixed isolated compiler entry point and source identity calculation. |
| `devdesk/runner/check.mjs` | Protected browser/API checks, private evaluator results and fixed backend startup coordination. |
| `devdesk/runner/backend-app.mjs` | Runs the edited application as UID 10001 with synthetic task data after the evaluator finishes compilation. |
| `devdesk/runner/backend-checks.mjs` | Compares API results to independent SQLite rows, including after new tasks and status changes. |
| `devdesk/runner/db-read.cpp` | Trusted read-only SQLite reader compiled into the runner image; never uses the candidate's repository code to compute expected rows. |
| `devdesk/runner/Dockerfile` | Protects evaluator code and installs the two-user runtime. App execution is unprivileged, resource-limited and isolated. |
| `tools/Build-RepairRunner.ps1` | Builds the pinned local runner. `-UseVerifiedBase` reuses a previously verified local image when the registry is unavailable. |
| `tools/preview-helper.mjs`, `devdesk/runner/preview.mjs` | Separate frontend/backend accepted-source previews, correct scenario labels, fixed ingress relay and runtime data copies. |
| `tools/Build-Workbench.ps1` | Freezes the protected profile/helper modules into fingerprinted immutable releases. Restart old worker terminals to use a new release. |
| `trusted_checks/phase7-*.mjs` | External authorization, scope, model workflow, containment, recovery, editor, review and read-only UI/preview evidence. These files are outside the model-editable checkout. |

The function restriction parses ordinary quotes, comments and balanced braces and compares the surrounding source. It normalizes CRLF/LF for scope comparison. It is a conservative text boundary check, not a general C++ parser or permission to edit arbitrary backend code.

## One actual end-to-end trace

The demonstration used a fresh PostgreSQL test schema, synthetic reporter Asha, the real configured Gemini provider and the buggy backend fixture. It did not silently approve or complete a manual report in the main workbench.

1. Asha submits “To do filter includes other statuses” at the backend URL.
2. Read-only investigation reads instructions and source and observes the controlled API. Relevant filter assertions fail. Run `6b2e74b8e8913705efd7086cb7390fe9` records a reproduced conclusion backed by observations.
3. DevDesk proposes the backend file/function scope, clean base, criteria, limits and hash. The demonstration authenticates as the reporter and approves that exact proposal through the real API. Other-user approvals are separately tested and denied.
4. Repair `9203284ddccfbc1da8d68f437cd35c75` creates a task worktree from base `a8531153d62904c175f01fdbd55361d79abe2bb2`. Its five received model decisions are source_read → run_checks → replace_text → run_checks → finish.
5. Baseline has 23 PASS and three relevant FAIL: `filter_todo`, `filter_matches_database`, `filter_after_mutations`. Seed identity and evaluator separation pass. Gemini supplies the SQL change; all 26 candidate assertions then pass.
6. Candidate `0ea464b86c4005c99c5e600bdd7da98bd0aa03f5` is published with exact diff, verification, images and source/build identity. Asha accepts the candidate through the real API; a new candidate would require fresh acceptance.
7. Integration `07cea189ea2bbc8d797d143237f2d6ac` checks current authority and clean base, applies the candidate, and runs all 26 assertions again inside Docker. Only this successful integration records FINISHED and moves the ticket to COMPLETED/history with a notification.
8. Preview activation builds the accepted source inside Docker. Backend shared Git now points to that candidate. Frontend remains at its previously accepted commit `4945512e8e8d07ca6901a1581bc1363d2cbc7254`; the clean playground remains unchanged.

Scope approval authorizes implementation. Candidate acceptance authorizes integration. They are separate authenticated decisions. Current integration is local Git. The requested future GitHub contributor → PR → reporter review → merge-admin notification → observed merged-main completion workflow remains a roadmap requirement, not a connected capability.

## How verification avoids checking the model with itself

Both profiles retain the 20 frontend/browser/API assertions. Backend adds six mandatory assertions: `evaluator_user_separated`, `seed_matches_database`, `filter_matches_database`, `filter_after_mutations`, `invalid_filter_rejected`, `database_preserved_by_reads`.

The evaluator uses UID 10002. Compilation completes before a fixed helper launches the edited application as UID 10001. The evaluator-owned source/binary are read-only to the app, and its report directory is private. The independent trusted C++ SQLite reader supplies expected database rows; API outputs must match those rows before and after dynamically generated tasks/status mutations. Reads must preserve the database. Invalid and duplicate filter inputs must be rejected.

Actual canaries proved that the app could not read or write the private evaluator report, signal evaluator PID 1 or switch to evaluator UID. Backend runs use no network, read-only container filesystem, dropped capabilities, no privilege escalation, bounded CPU/memory/processes, tmpfs and a wall timeout. No model-edited application was compiled or executed on the Windows host.

This demonstrates the tested filesystem/process boundaries; it is not a proof against all native exploits. Preview deployment uses a separate fixed relay and an internal app network. The earlier denied TCP egress probe is not a general proof against every outbound networking technique.

## Actual evidence and limitations

All paths below are workspace-relative. Evidence may contain local account/configuration files: inspect relevant reports locally rather than sharing whole directories.

| Verification | Actual result | Report |
| --- | --- | --- |
| Real Gemini workflow | 13 PASS; candidate 26/26 and integrated 26/26 | `var/evidence/phase7-live-2026-10-12T13-12-50.704Z-13644/report.json` |
| Buggy backend baseline and containment | 14 PASS; underlying baseline has three intentional FAIL | `var/evidence/phase7-runtime-15a3e766b2d0917a010180c59fd315d9/report.json` |
| Final image backend and containment | 14 PASS; healthy accepted source 26/26 | `var/evidence/phase7-runtime-178495f139382d5c165e22a64f8755dd/report.json` |
| Final image frontend compatibility | 10 PASS; accepted source 20/20 | `var/evidence/phase6-runtime-bdc0fdfa1fd297bff9a43187390b4d89/report.json` |
| Authorization/API contracts | 18 PASS, scripted decisions, zero inference | `var/evidence/phase7-auth-1791808666418/report.json` |
| Function-scope policy | 7 PASS, in-memory test fixtures | `var/evidence/phase7-policy-1791810598188/report.json` |
| Actual model patch newline handling | 3 PASS, private worktree, no application execution | `var/evidence/phase7-text-e3cd2c33112ba9ebce6ffb61e706d740/report.json` |
| Backend integration journal recovery | 5 PASS, seeded crash records using real journal | `var/evidence/phase7-backend-recovery-751de179956b9e3215d29110fc674172/report.json` |
| Existing frontend journal recovery | 5 PASS | `var/evidence/phase6-integration-9cc0afd0cafc62a3e2195589c563d40b/report.json` |
| Existing reliability | 27 PASS | `var/evidence/phase6-7a094de74cdb53d61b5a6af53a9101de/report.json` |
| Workbench regression | 95 PASS | `var/evidence/phase2-2026-10-12T13-22-20.938Z-30304/report.json` |
| Completed-history Chrome | 5 PASS, screenshot inspected | `var/evidence/phase7-ui-2026-10-12T13-32-31.579Z-11736/report.json` |
| Final-release exact candidate review API | 10 PASS; no model or source changes | `var/evidence/phase7-review-f23e2da7998185decac5c4544b362eba/report.json` |
| Final-image backend preview | 11 PASS; read-only API and Chrome at 390/1280 | `var/evidence/phase7-preview-1791813022744/report.json` |
| Final-image frontend preview | 10 PASS; read-only API and Chrome at 390/1280 | `var/evidence/phase6-preview-1791813430521/report.json` |

The successful live workflow used release `bad81a99...` and runner `sha256:a40...`. Final release is `f8e60ab91c3269b1b82fe21ef4f0e2399664384990590f4dd5ba31673b1959d9`, final image `sha256:e47bc0007ab551b97d27b0ee00eb31d33ee0450662ede11150477d425d8eee46`. Subsequent changes corrected the candidate inspection digest field and backend preview scenario label. Final-image backend/frontend execution and final-release candidate review were checked separately; the live model run was not repeated or relabeled as a final-image run. The 95-check regression preceded those final changes.

Successful investigation: five received inferences, 10,508 input/576 output tokens, estimated $0.005125. Successful repair: five inferences, 14,727 input/648 output, estimated $0.006928. Combined successful estimate: $0.012053. Provider is Gemini, user-selected alias `gemini-3.5-flash-lite`; the alias is not an immutable dated model snapshot.

Earlier attempts are retained: provider HTTP 503 with unknown billing; repeated instruction retrieval; an unsupported conclusion based on irrelevant browser feature evidence; and an LF patch failing to match CRLF source. Received-known estimates across all 25 received decisions total $0.027349. Including the first failed request, there were 26 attempts. That request's billing is unknown, so the entire session cost is not established. These are estimates, not a billing statement or a reliability success percentage.

The contract fixes remove already-completed immutable tool choices, require backend API evidence, and return canonical LF source text with a physical-byte digest. Exact patch matching translates newlines to the source's style and preserves CRLF. It does not fuzzily locate or invent a replacement. The actual earlier model patch was used to verify this adapter in a private worktree. No production known-patch lookup was added.

Other retained failures include Docker HTTP500, external registry/apt fetch errors, an initial C++ compile error and initially missing profile fields in detail responses. A verified local runner ancestor enabled the build without weakening TLS. All final passing claims above refer to actual saved reports. Journal recovery uses deliberately seeded interrupted database records, not an actual process kill during every merge instruction. The reliability suite includes a real lease-holder kill, but not a kill during paid inference.

## Run and inspect it yourself

From `C:\AI_employee`, start the workbench and continuous workers in separate terminals:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1
```

Keep Docker running and both terminals open. Restart any old worker terminal so it selects the current release. Main-workbench manual reports remain in their original schema and state. The completed live demonstration is in a separate test schema; it will not appear in the main workbench just because its source was integrated.

To view the actual completed demonstration on a separate free port:

```powershell
$phase7Release = (Get-Content .\devdesk\build\latest.json -Raw | ConvertFrom-Json).directory
& "$phase7Release\devdesk.exe" --serve C:\AI_employee\var\evidence\phase7-live-2026-10-12T13-12-50.704Z-13644\test-config.json 8105 "$phase7Release\static"
```

Open http://127.0.0.1:8105 in a private browser window. Log in as `asha` using her password from that demonstration's local `accounts.json`; never paste credentials into chat. Cookies are scoped to the host, so a separate browser session avoids collisions with the main workbench login. Open History → View report. Cross-check COMPLETED, the one-line diff, exact `0ea464...` candidate, 26 passing checks, screenshots and FINISHED integration. Stop this demonstration server with Ctrl+C.

Open backend preview at 8082 and click To do: two cards, both To do. Read-only API checks:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8082/api/health'
(Invoke-RestMethod 'http://127.0.0.1:8082/api/tasks?status=todo').tasks
(Invoke-RestMethod 'http://127.0.0.1:8082/api/tasks?status=done').tasks
```

Do not reset the accepted shared fixture to reproduce the old bug. Inspect its original source and retained failing baseline instead:

```powershell
git -C .\var\fixtures\backend show a8531153d62904c175f01fdbd55361d79abe2bb2:src/task_repository.cpp
git -C .\var\fixtures\backend show --stat 0ea464b86c4005c99c5e600bdd7da98bd0aa03f5
```

To recheck current healthy containment, `node trusted_checks/phase7-runtime.mjs` and `node trusted_checks/phase6-runtime.mjs` use Docker and no model inference. Read-only preview checks are `phase7-preview.mjs` and `phase6-preview.mjs`. Current review/history and recovery scripts use fresh schemas. The archived authorization, patch-format and real live drivers assume the original buggy baseline; do not blindly rerun them against the repaired shared fixture. A newly submitted identical bug should not be classified as reproduced merely because an old report described it.

## Interview practice and learning checkpoint

1. **Why did Done work while To do failed?** Explain row predicates versus a parameter-only predicate. For todo the extra OR is always true; for done it is false. Walk through the table above.
2. **How do you trust checks on model-edited C++?** Scope permission first; protected evaluator and independent database reader second; unprivileged app/evaluator UID separation and container restrictions third; exact candidate/build binding and post-integration checks last. State the tested limits honestly.
3. **Why two human decisions and two verifications?** Scope approval permits bounded edits. Candidate acceptance permits that exact commit's integration. Candidate checks establish behavior in its task workspace; integrated checks establish behavior at the actual shared integration point. Changed authority/source/checks invalidate readiness.

Exercise: without editing source, write the expected API IDs for empty, todo, in_progress and done under both SQL predicates. Find the three baseline failures in the archived runner report and explain which independent check would catch a model returning hard-coded seed outputs after new tasks are created. Then inspect the real diff and identify the unchanged parameter binding and RAII destructor responsibility.

Pause here for this learning checkpoint. Phase 8 has not started. Its next work is roster snapshots, unique authenticated votes, a deadline and threshold `ceil(2N/3)` (N=4 needs 3 yes; N=5 needs 4), followed by approved feature implementation through the existing repair/acceptance/integration path. Reply “continue” when ready.
