# Phase 8: feature consensus and implementation

Phase 8 adds a real feature poll and demonstrates a real Gemini implementation of the missing Completed filter. Voting, implementation permission and final acceptance are separate decisions. The current supported feature capability is deliberately limited to this filter on the feature playground at localhost:8083. Other feature ideas can be submitted, but need a reviewed capability before autonomous implementation; the system does not silently implement arbitrary features using this scope.

## Workflow and voting rules

1. An employee submits a feature request with its desired behavior and feature-playground URL. The investigator retrieves source and observes the running browser. Its evidence must show that the requested Completed filter is absent. No edits occur during this assessment.
2. The reporter prepares the published scope: source base/build, allowed HTML navigation, acceptance criteria, limits, hash and expiry. A poll snapshots all active project members, including the reporter. Each gets an in-app notification. Membership changes later do not change this poll's denominator.
3. Members review that scope and vote YES or NO. The reporter separately approves the source-change scope. Either decision can occur first. Repair becomes READY only when both exact scope approval and sufficient consensus exist.
4. The existing bounded repair worker creates an isolated task worktree, reads source, establishes a failing baseline, receives the model's patch and runs independent checks inside Docker. A passing candidate is published for the reporter.
5. The reporter accepts or rejects the exact candidate. Only acceptance permits local Git integration. All required checks run again at the shared integration point before COMPLETED/history/notification.

The threshold is integer `ceil(2N/3)`, implemented as `(2*N+2)/3` for positive N. Polls support 1–1000 members.

| Snapshot members | Yes votes required | Examples |
| --- | --- | --- |
| 4 | 3 | Two yes votes are insufficient; three pass. |
| 5 | 4 | Three are insufficient; four pass. |

A vote is authenticated, CSRF-protected and bound to the exact poll goal hash. Each snapshot member can cast one immutable vote. Repeating the same vote is idempotent; changing it is denied. A new member outside the snapshot cannot vote. A removed/inactive member cannot cast a new vote, and the snapshot denominator remains unchanged. A previously valid vote remains part of that historical snapshot.

The poll closes PASSED as soon as the threshold is reached. It closes REJECTED if remaining members cannot possibly meet the threshold, or if the deadline arrives without enough yes votes. No response is not approval. Rejection moves the ticket to INVALID history and notifies the reporter, preserving votes and evidence. The poll deadline is the published scope's 30-minute expiry. Closed polls refuse new votes; identical existing-vote retries remain safe. Changed/withdrawn scopes make their polls STALE; old votes do not authorize a replacement scope. Poll expiration/reconciliation runs during the continuous worker's recovery cycle and on vote submission. Refresh alone does not run a background timer when workers are stopped.

Waiting for votes releases worker capacity. Even a forged READY row without a passed matching poll is skipped by repair selection. Repair checks full consensus before claiming and before model/tool steps. Candidate decisions, integration and interrupted-integration recovery also require exact feature consensus. Scope approval does not imply a yes vote, and a passed poll does not skip reporter scope approval or final candidate acceptance.

## Files and functions to understand

| File/symbol | Role |
| --- | --- |
| `devdesk/db/008_feature_consensus.sql` | Feature states/profile, polls, fixed roster and unique votes. SQL enforces the threshold formula and snapshot vote foreign key. |
| `devdesk/src/consensus.hpp`, `consensus.cpp` | C++ consensus module. `open_feature_poll` snapshots members and sends persisted in-app notices; `cast_feature_vote` serializes votes; `reconcile_poll` counts, closes and transitions; `require_feature_consensus` guards later effects. |
| `devdesk/src/routes.cpp` | Reporter-only feature scope preparation, authenticated vote endpoint, approval readiness and poll detail. INVALID appears in history rather than active queue. |
| `devdesk/static/app.js` | Displays exact scope, fixed denominator, threshold, deadline, members/choices and YES/NO controls. Explains waiting consensus separately from scope approval. |
| `devdesk/src/worker.cpp`, `provider.cpp`, prompts | investigation-v7 requires browser evidence for this feature; only the missing-filter assertion supports the conclusion. repair-v3 explains approved feature scope without supplying a patch. |
| `devdesk/src/repair_profile.hpp`, `tools/repair-profile.mjs` | Registers feature origin8083 and `static/index.html`; `assertProfileScope` permits only plain buttons inside the existing filter nav. Existing button markup stays unchanged; the new Completed label and inactive initial state must match the reviewed capability. Scripts, event handlers and other markup are denied. |
| `devdesk/src/repair.cpp`, `integration.cpp` | Reuses the existing patch/check/commit and exact candidate acceptance/integration machinery with consensus guards. |
| `devdesk/src/reliability.cpp` | Reconciles poll deadlines/staleness, checks feature consensus during journal recovery, and activates three accepted-source previews. |
| `devdesk/runner/check.mjs`, `runtime-build.mjs` | Existing 20 assertions plus `completed_filter_390` and `completed_filter_1280`. Real clicks compare rendered Completed IDs/statuses to the done API, while existing browser/API regressions still run. |
| `tools/preview-helper.mjs`, `devdesk/runner/preview.mjs` | Feature's separate internal app network, trusted relay at8083 and runtime data copy. Accepted preview uses `accepted-feature` display scenario to avoid the obsolete “filter unavailable” caption. |
| `tools/Setup-DevDeskPostgres.ps1`, `Setup-Phase2Test.ps1` | Apply migrations and restrict runtime rights: votes and snapshot members cannot be updated; poll runtime updates are limited to state/closed_at. |
| `trusted_checks/phase8-*.mjs` | External consensus, containment, real-model, exact-review, journal recovery, history and preview evidence. These are outside editable application scope. |

Ticket and poll row locks serialize votes and threshold transitions. A database primary key `(poll_id,employee_id)` supplies a second duplicate guard. Events and notification rows share the transition transaction; unique operation keys prevent repeated outcome notifications. These are local PostgreSQL/in-app notifications, not external email or GitHub messages.

The feature edits HTML navigation only. Existing JavaScript already implements generic `data-filter` buttons and the API already supports `status=done`; therefore no C++ playground or JavaScript change was required for this candidate. The model selected its HTML change. Permission checks constrain the area and semantics; they do not choose a stored patch. No edited application code was compiled or executed on the Windows host.

## One actual real-model trace

The live demonstration used a fresh test schema and synthetic accounts. Main-workbench manual records were preserved.

- Report: Asha requests “Add a Completed filter” at8083.
- Investigation `cf89d9422a6b935d271bef240e8cea70`: five received Gemini decisions; real browser observation confirms `completed_filter_present` FAIL. Base commit `a23112f3c050f1c948ddc758e667f0c6d23540ee`.
- Scope `95a3b026fe5a7df6a75d824da7a74e2a`: exact HTML/filter-nav permission. The driver authenticates as Asha for scope approval and as Asha, Ravi and Maya for three YES votes out of the fixed four-member roster. These are synthetic human actions through the real APIs, not autonomous approval of the user's reports.
- Repair `388b7faab6af6ecc1fee0840acfb4140`: five received model decisions, source_read → run_checks → replace_text → run_checks → finish. Original baseline has20 PASS and the two intentional missing-filter FAILs. Candidate has22 PASS.
- Gemini adds a Completed navigation button. Candidate commit `b8509a4cb64bc19be911d0a5800d0e88aa29cc2c` changes only `static/index.html`.
- Asha accepts that exact candidate through the real API. Integration `b04da9bc612b12f3e14de3d216624286` runs22 post-integration assertions, all PASS. Only then does the feature ticket become COMPLETED.

Successful live report: `var/evidence/phase8-live-2026-10-12T14-24-51.126Z-8204/report.json`, **15 PASS/0 FAIL**. Provider is Gemini, user-selected `gemini-3.5-flash-lite` alias. Investigation received11,322 input/567 output tokens, estimated$0.005436; repair12,042 input/565 output, estimated$0.005721. Total10 received inferences, estimated **$0.011157**, complete received usage. This is an application estimate, not the provider's billing statement or an immutable dated model snapshot. No further inference was needed for final verification.

## Checks, retained failures and limits

Consensus report `var/evidence/phase8-consensus-1791814966958/report.json`: **44 PASS**, real authentication/API/Chrome, one scripted read-only investigation using actual tools and additional explicitly copied observation fixtures in a fresh schema; zero inference calls. Covers N4/N5 math, new/removed members, CSRF/ownership, immutable replay, deadlines, impossible threshold, INVALID/history/notices, restart, staleness, database update rights, out-of-scope HTML and a real browser NO vote. These are deterministic contract tests, not 44 live model runs.

Exact candidate review report `var/evidence/phase8-review-7f6754b804ab58e846960f4033089f18/report.json`: **14 PASS**. Fresh clone of the actual candidate records; concurrent identical votes create one effect, concurrent threshold votes close once, stale/falsely-passed consensus blocks decisions, unknown checks deny acceptance, rejection cannot be changed to acceptance and remains unintegrated. Source is preserved; poll replay states are deliberately seeded only in this private test schema.

Feature recovery report `var/evidence/phase8-feature-recovery-75e825c5a9b4fd0f45ee1e414a03e9a6/report.json`: **7 PASS**. Reconciles the real verified journal in explicit interrupted database states without Git replay. Missing journal and stale consensus block completion. This does not claim a real process kill at every merge instruction.

Completed-history Chrome report `var/evidence/phase8-ui-2026-10-12T14-35-38.777Z-12036/report.json`: **5 PASS**, exact commit/integration visible, both candidate images load, acceptance controls disappear, no script errors. Screenshot visually inspected. Final wording and preview checks are recorded in BUILD_STATUS.

Existing regressions: workbench95 PASS (`phase2-2026-10-12T14-25-02.300Z-27876`), reliability27 PASS (`phase6-8ba23a62c27ba5e80a8e813dfce2d84c`). Final-image frontend runtime10 PASS (`phase6-runtime-4bb6361e08008acba5a57337a9020660`), feature runtime10 PASS (`phase8-runtime-e5fbb75eea841b9e86b6a5dd3b8820c6`), including22 accepted-source assertions. The original feature baseline runtime10 PASS is `phase8-runtime-06eba4254d6f276f5cb7d6bab6159051` with exactly the two expected failing assertions. Final backend/preview paths and release/image identifiers are in BUILD_STATUS.

Final release: `dd1953bafd7d8c5e21b2f20f0ff6b93038d0bef09c6a5266d7aee1dfde4b6388`. Final image: `sha256:52cda86a5b0f1250b5f70331ceab3183344939944c39669df8bbbae14f652386`. Final backend runtime14 PASS: `var/evidence/phase7-runtime-8f8da1ac621b215aeec7bdbf84984621/report.json`. Final feature preview11 PASS: `var/evidence/phase8-preview-1791817126123/report.json`; existing frontend preview10 PASS: `phase6-preview-1791817428303`; backend preview11 PASS: `phase7-preview-1791817428202`. Final-wording completed-history5 PASS: `phase8-ui-2026-10-12T14-41-56.323Z-21348`. All report folders are under `var/evidence`. Backend26/frontend20/feature22 healthy assertions passed on the final image. Verification metadata was reconciled from saved receipts only after checking exact image, clean current Git head and mandatory healthy assertion count for each profile; no success flag was copied from an untested image.

The live model run used release56215295... and image89e653de.... Later changes tightened existing-filter/label preservation, checked consensus during recovery, clarified UI wording and removed the obsolete preview caption. Final affected paths were checked separately; the earlier live run was not falsely relabeled as a run on those versions. Workbench95 and reliability27 precede those final changes. Recovery7 and review14 exercised the new guards; final UI5 exercised the wording. Offline current release: worker22 and repair8+4 PASS, zero model calls.

Retained failures: a source-edit utility encountered existing CRLF formatting; the first reliability test collided with the live worker's global lease and correctly could not acquire ownership; a review test ran while the rebuilt image was still unverified; an initial UI test incorrectly counted all report images as exactly two, although a feature investigation includes its own baseline screenshot. The last test now counts the two candidate images specifically. Passing reruns are retained separately; no permission or check was weakened to turn these failures into success.

Limits: one registered feature capability, local Git integration, single-host worker capacity, fixed local synthetic accounts, in-app notifications and a foreground launcher. No schema migrations to playground data, arbitrary feature generation, distributed polling or GitHub PR synchronization is claimed. Docker boundaries cover the demonstrated restrictions; they are not universal native exploit or network-isolation proofs. The future contributor PR → reporter GitHub review → merge-admin notification → observed merge to main → COMPLETED requirement remains in SPEC.

## Run and inspect

Start/restart the workbench and continuous worker launcher in separate PowerShell terminals from `C:\AI_employee`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1
```

Keep Docker and both terminals running. Workers pick the current immutable release on startup. Workbench is http://127.0.0.1:8094; feature preview is http://127.0.0.1:8083. Click Completed: the seed's completed task appears, and existing filters/task actions remain available. Avoid mutating preview data if comparing the recorded seed results.

The actual completed demonstration uses its own schema. To inspect it without replacing your main workbench:

```powershell
$phase8Release = (Get-Content .\devdesk\build\latest.json -Raw | ConvertFrom-Json).directory
& "$phase8Release\devdesk.exe" --serve C:\AI_employee\var\evidence\phase8-live-2026-10-12T14-24-51.126Z-8204\test-config.json 8105 "$phase8Release\static"
```

Open http://127.0.0.1:8105 in a private browser window. Use Asha's local password from that demonstration's `accounts.json`; never share account/config files or keys. History → View report shows the published scope, fixed four-member poll, three YES votes, model trace/diff, exact b8509a4... candidate and FINISHED integration. Stop this separate server with Ctrl+C. Browser cookies share the host across ports; a private session avoids colliding with a main-workbench login.

For an open-poll UI example, the consensus test's `test-config.json` and `accounts.json` are in `var/evidence/phase8-consensus-1791814966958`. Serve it on a free port using the same command form. Its last feature poll contains Noah's real browser NO vote. Log in as another eligible member to inspect controls; choose deliberately because votes are immutable. These are synthetic test records, not the main workbench.

The shared feature is now implemented. Submitting the identical missing-filter request again should not reproduce its absence. Do not reset accepted source to manufacture a new live run. Original failures/source are available in the archived baseline evidence and read-only `git show` at a23112f.... The consensus driver assumes the missing-feature baseline and is archival after integration. Healthy runtime, preview, cloned review/history and recovery drivers can verify the current candidate without new model inference.

## Learning checkpoint

Three interview questions:

1. Why `ceil(2N/3)` and a snapshot? Explain integer rounding (4→3,5→4), fixed denominator, and why membership changes cannot silently lower an active threshold.
2. Why do votes not replace both reporter decisions? Consensus authorizes the exact proposed feature; reporter scope approval permits bounded source changes; final acceptance authorizes one checked commit's integration.
3. How do concurrent votes and crashes avoid false completion? Ticket/poll locking, unique votes, transactional outcome notices, current hash/count guards, protected checks and verified-journal recovery; missing evidence blocks rather than invents success.

Exercise: for N=5, work out the outcomes of three YES/two absent, three YES/two NO, and four YES/one absent. Locate the threshold check and unique vote key in migration008. Then explain why replaying YES creates no second vote and why changing the proposal requires a new poll. No source reset is needed.

Phase 8 is complete; pause at this learning checkpoint. Phase 9 has not started. It will package reproducible setup, the critical scenario suite, disclosures/limitations and interview/demo practice. Reply “continue” when ready.
