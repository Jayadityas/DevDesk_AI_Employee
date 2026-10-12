# Phase 5: exact-candidate acceptance and verified source integration

Phase 5's single-bug source workflow is demonstrated. A synthetic requester accepted the real Gemini candidate from Phase 4, guarded Git integration applied it, and all 20 post-integration container assertions passed. The demonstration ticket reached `COMPLETED`, appeared in persistent history and received an in-app notification. Manual workbench reports and task data were preserved.

Completion here means verified source integration. Existing native preview processes and their frozen build snapshots are not automatically redeployed. The frontend source is now at the accepted commit, while its old `build` snapshot still describes the original fixture. Do not interpret an old preview as the new release or bypass the investigator's source/build identity check. Preview activation and repair crash recovery remain limitations to address in subsequent work; do not build model-edited application code on the host to work around isolation.

Docker worked for the successful integration. Later it returned HTTP 500 again during an additional private-clone rollback test. Existing completed evidence remains valid. Future repair/integration execution requires a healthy engine; no new candidate should be considered checked merely because the old runner record says verified.

## New files and responsibilities

| File | Purpose |
| --- | --- |
| `devdesk/db/004_acceptance.sql` | Candidate reviews, immutable requester decisions, integration runs and new ticket states. |
| `devdesk/src/integration.hpp` | Review, decision and integration-worker entry points. |
| `devdesk/src/integration.cpp` | `checked_candidate` requires all 20 named assertions; `prepare_review` binds a review; `decide_review` authorizes an immutable decision; `run_integration` serializes source mutation and completion bookkeeping. |
| `devdesk/src/routes.cpp` | Authenticated review/decision endpoints, review/integration detail and completed/rejected history. |
| `devdesk/src/main.cpp` | Adds `--integrate config root`. |
| `devdesk/static/app.js` | Requester review/accept/reject buttons, exact commit and evidence, integration results and completed history. |
| `tools/repair-helper.mjs` | Fixed `integrate` operation: candidate/base/scope checks, Docker preflight, fast-forward, post-integration checks and guarded Git rollback. |
| `tools/Start-Workers.ps1` | One terminal launcher continuously polls integration, investigation and repair. It owns and cleans child processes. No Windows startup task/service is installed. |
| `tools/Setup-DevDeskPostgres.ps1` | Preserves the cluster, applies ledgered migrations and denies updates/deletes of acceptance decisions. This missing script was restored during resume. |
| `tools/Build-Workbench.ps1` | Frozen release build including the integration module. This missing script was also restored; selecting the existing matching release was verified. |
| `trusted_checks/phase5.mjs` | Real Phase 4 candidate continuation, requester controls, stale inputs, rejection, integration, history and duplicate guards. |
| `trusted_checks/phase5-stale.mjs` | Fresh negative fixture: obsolete base blocks integration and leaves shared source untouched. |
| `trusted_checks/phase5-ui.mjs` | Actual completed-history Chrome check, candidate screenshots, evidence and absence of repeat-acceptance controls. |
| `trusted_checks/phase5-rollback*.mjs` | Private-clone rollback preparation/execution and explicitly labeled Docker-create fault injection. |

`var/integration-jobs/<id>/mutation.json` records PREPARED, APPLIED and VERIFIED/BLOCKED stages. This is retained operation evidence, not a complete crash-recovery protocol. Integrated reports/screenshots are under `var/repair-evidence/<integration-id>/1`.

## One request through the implementation

1. A verified repair already has `CANDIDATE_READY`, a candidate commit, diff and latest successful check receipt.
2. The requester prepares a review using `POST /api/repairs/{id}/review`. The API checks ownership and all mandatory evidence. A pending unexpired review is reused; expired pending reviews become stale and a new review is created.
3. The review binds requester, repair/ticket, candidate commit, scope hash, evidence step and content, review ID and a 30-minute deadline. The ticket becomes `AWAITING_ACCEPTANCE` and a notification is persisted. It is separate from the earlier permission to patch source.
4. `POST /api/candidate-reviews/{id}/decision` accepts `review_hash` and `ACCEPTED` or `REJECTED`. Authentication, membership, CSRF, requester identity, binding, expiry and current evidence are checked. Unknown or changed checks block the decision. A repeated identical decision is idempotent; changing an existing decision fails.
5. Rejection records `CANDIDATE_REJECTED` in history without source mutation. Acceptance records `ACCEPTED`; it does not mark completion.
6. `run_integration` takes a database-wide advisory lock for the shared integration point and the project worker lock. Only an active member's unexpired accepted review can be claimed. A durable run is recorded before external source operations.
7. The fixed helper requires clean shared and candidate checkouts, the expected shared base, the exact candidate HEAD and parent, CSS-only changes and the accepted CSS digest. Docker must answer its Linux preflight before Git mutation.
8. Git fast-forwards the shared frontend checkout to the candidate. The helper checks the integrated source using the restricted runner and verifies source identity again afterward.
9. Only successful integrated checks produce `COMPLETED` plus history, event and notification in one database transaction. Failure produces `INTEGRATION_BLOCKED`, never completion.

If a failure occurs after applying the candidate, rollback restores only the authorized CSS from the previous base and creates a new commit. It preserves history. Rollback refuses to overwrite intervening commits or dirty user work. Source rollback does not reset PostgreSQL or task data. A crash between Git and database bookkeeping remains an ambiguous operation for Phase 6; it is not blindly replayed.

## Actual demonstration and evidence

Final backend release: `20c2d0bc48333e48ad2741653f863dfcaadcfe5b3b4a2626fd77725cb8015b09`.

- Accepted candidate and current shared frontend commit: `4945512e8e8d07ca6901a1581bc1363d2cbc7254`.
- Previous base: `4c0e6bab2605378fbbb33f82b1fd37e7bb458ed0`.
- Integration run: `5ccec08da5757a15976c94164dc94ebe`.
- Main report: `var/evidence/phase5-2026-10-12T02-44-21.225Z-28452/report.json`: **23 PASS, 0 FAIL**.
- Full trace: the same directory's `redacted-trace.json`.
- Integrated report and two screenshots: `var/repair-evidence/5ccec08da5757a15976c94164dc94ebe/1`: **20 PASS, 0 FAIL**.
- Stale-base test: `var/evidence/phase5-stale-2026-10-12T02-53-43.775Z-3336/report.json`: **4 PASS**.
- Chrome history test: `var/evidence/phase5-ui-2026-10-12T02-54-47.761Z-20192/report.json`: **5 PASS**, with `completed-history.png`.
- Current release's DevDesk regression: `var/evidence/phase2-2026-10-12T02-51-48.945Z-20528/report.json`: **95 PASS**.
- Investigator regression before shared integration: `var/evidence/phase3-2026-10-11T18-45-49.769Z-23432/report.json`: **57 PASS**. Two conditional preservation checks were absent because that driver owned its fixture process. This is a pre-integration baseline check, not a claim that the obsolete native snapshot now matches the new source.

The acceptance suite used fresh synthetic schemas containing the original real candidate and receipts. It tested rejection/no integration, other-member and nonmember denial, wrong hash, expired review, changed candidate, unknown evidence, duplicate decisions, post-integration checks, history/queue placement, notification and no repeated integration. Phase 5 made **zero new inference calls**; it continued the actual model-produced candidate instead of fabricating a repair.

The launcher was verified on the completed synthetic schema for six seconds: **three polling cycles, nine child runs**, clean bounded shutdown and a read-only provider access probe. It did not run new investigations or patches. This does not establish Windows service behavior or interactive Ctrl+C under active inference.

Private rollback test: `var/evidence/phase5-rollback-2026-10-12T03-45-48.554Z-24568/docker-fault-audit-report.json`: **5 PASS**. A test-only Node import intercepted Docker-create and deliberately failed it after the real helper applied a candidate in a private clone. The actual Git rollback branch restored the prior CSS, created a new commit and left the real shared checkout untouched. No production helper or evaluator was weakened. The test did **not** run a real container. A line-ending-sensitive assertion was corrected to compare normalized working content plus exact Git blobs; the earlier failed assertion/report is retained. Audit used the existing result, with no second source mutation.

Earlier clone ownership failures and real Docker-preflight failure are retained. The extra real-container bad-CSS integration rollback was not demonstrated because the engine returned HTTP 500; real successful integrated checks and the labeled failure-path test are separate evidence. Fresh-machine database bootstrap and a cold rebuild of the restored scripts remain unverified.

## Startup and manual walkthrough

From `C:\AI_employee`, use one terminal for the workbench and another for the workers:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1
```

The launcher keeps polling while that terminal stays open. Start it once; do not also run separate investigator/repair loops unnecessarily. Closing it stops its owned child. It does not automatically start after Windows login. Human scope approval and final candidate acceptance are still required.

When a ticket has a verified candidate: open its report, review the exact commit, CSS diff, screenshots and assertions, click **Prepare candidate acceptance review**, then choose **Accept candidate and authorize integration** or **Reject candidate**. Refresh to see integration results and in-app notifications. Only the requester sees these actions. A completed or rejected ticket moves to History.

For isolated worker inspection, the native entry point is:

```powershell
$release = (Get-Content .\devdesk\build\latest.json -Raw | ConvertFrom-Json).directory
& (Join-Path $release 'devdesk.exe') --integrate .\var\config\workbench.json C:\AI_employee
```

Do not rerun the original successful integration suite expecting the old base: the shared source has intentionally advanced. Do not reset accepted source to satisfy an old fixture expectation. Negative tests use fresh schemas/private clones and must stay explicitly labeled. Never paste local credentials into chat or share complete evidence/config directories.

## Interview practice and exercise

1. Why is scope approval different from candidate acceptance? Explain permission to attempt a change versus approval of an exact checked result.
2. Why do database transactions not make Git integration atomic? Explain the mutation journal, advisory lock, crash gap and recovery still needed.
3. Why use a new rollback commit? Explain retained history and why intervening or dirty work prevents automatic rollback.

Exercise: follow `review_hash` from preparation to decision to integration claim. Identify what makes a repeated acceptance safe and what changes make evidence stale. Inspect the real completed trace and the private fault trace; explain why only one can support `COMPLETED`.

Phase 5's core implementation and single-bug demonstration are complete. Pause at the learning checkpoint. Phase 6 should cover interrupted operations, leases/fencing, cancellation, stale decisions and queue concurrency, with preview/build activation explicitly addressed.
