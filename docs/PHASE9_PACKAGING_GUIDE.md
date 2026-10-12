# Phase 9: source package and interview ownership

The delivered source archive includes C++ control-plane code, protected helpers/evaluator, PostgreSQL migrations, UI, licenses/lockfile, setup/launch scripts, learning documents and selected assertion-only reports. A Git bundle preserves the clean playground and accepted fixture histories. No local keys/accounts/databases/uploads/native releases/node_modules/Docker image are distributed. It is a source handoff, not an offline installer.

## Files and one actual packaging trace

- `tools/Package-DevDesk.mjs`: copies an explicit source allowlist, exports selected Git refs, records original/accepted fixture IDs, extracts assertion-only reports, hashes files and creates the ZIP/checksum pointer.
- `tools/Restore-PackagedFixtures.ps1`: clones the packaged Git bundle and creates three isolated worktrees. Default is accepted source; `-Baseline` on a fresh package selects original defects. Existing worktrees are preserved.
- `trusted_checks/phase9-package.mjs`: extracts the actual ZIP, verifies manifest/checksum, checks for this machine's known secrets in packaged files and Git objects, restores accepted and fresh-baseline fixtures, and verifies that a rerun cannot reset accepted source. It does not execute application code or initialize a second database cluster.
- `trusted_checks/verify-runner.mjs`: fresh-package profile verification without historical local configuration. Invokes the frozen helper, actual canary/timeout and protected assertions; exact registered results bind verification to the current image. `--baseline` permits only the specific expected deliberate failures.
- `trusted_checks/phase9.mjs`: validates historical evidence, then runs current Workbench/reliability checks and bounded documented startup. No inference or shared patches.
- `docs/verification-index.json`, `VERIFICATION_MATRIX.md`: source report pointers and exact critical-scenario coverage.
- `SETUP_AND_DEMO.md`, `DISCLOSURES_AND_LIMITS.md`, `INTERVIEW_AND_DEBUGGING.md`: prepared-machine setup, recording plan, stack/model/AI disclosures, limits and practical ownership exercises.

Actual trace: the package builder exported main plus the three fixture branch histories and phase1-clean tag. The archive test extracted that ZIP into a new private evidence directory, checked each file hash, scanned known local secrets without printing them, cloned the bundle and restored all three exact accepted commits. A second fresh extraction restored the original frontend/backend/feature commits. Rerunning `-Baseline` against an existing accepted extraction preserved its accepted commit. The current original workspace's source/data remained unchanged.

Final current suite: `var/evidence/phase9-1791819003296/report.json`,27 PASS/0FAIL. It validated15 historical assertion reports, ran offline policy checks, current95-check Workbench regression and27-check reliability suite, served login using the documented launcher on a new port8110, checked clean bounded exit and confirmed all three source heads/original databases were preserved. No live model calls occurred. This27-check orchestration result is separate from its underlying95/27 assertions and the historical suites; do not sum them as independent model trials.

First source archive verification: `var/evidence/phase9-package-1791819599191/report.json`,15 PASS/0FAIL. Final regenerated archive is identified by `var/packages/latest.json`; the latest package-check report is recorded in BUILD_STATUS. The archive includes the documentation updates, rather than the full local account/config evidence directories.

Fresh-package commands, actual Docker: frontend10 PASS `var/evidence/runner-frontend-19c006efa2fb8f22ee02b0bb81def65e/report.json`; backend14 PASS `var/evidence/runner-backend-b8165a5fddab0cc956d69d057687fac7/report.json`; feature10 PASS `var/evidence/runner-feature-bfd1edc82f86c572b86e5fe6f514e7f6/report.json`. Underlying healthy assertions20/26/22 all PASS. Initial frontend attempt stopped at Docker API HTTP500 before verification; after the user's engine restart the same command passed. An initial ZIP helper was blocked by PowerShell execution policy; the trusted subprocess now uses the same process-local ExecutionPolicy Bypass as the documented launchers, without changing system policy. Passing archive reruns are retained separately. `var/evidence/phase9-package-latest.json` binds final package verification to its exact ZIP checksum.

## What is proved and what is still external

Three application scenarios have actual Gemini candidates and verified integration: frontend20, backend26 and feature22 mandatory assertions. Human approval/voting/acceptance in those pilots were explicit synthetic authenticated test actions; manual reports were preserved. The final software stack, selected model alias, varying build versions, estimated usage and failed attempts are disclosed in the phase guides and BUILD_STATUS. Codex assistance is disclosed; no guaranteed hiring/repair or broad success rate is claimed.

Git bootstrap was tested in extracted copies; current configured startup and runtime were tested. A clean dependency installation, new PostgreSQL cluster and external image pull were not demonstrated on another machine. Docker occasionally returned HTTP500. The package needs the documented Windows prerequisites and network access for initial dependencies/model calls. Native control-plane Linux/macOS portability remains untested.

Source is provided as a local archive, not a published GitHub URL. The source-link/publication part of an external submission still requires a destination and an explicit publishing action. A recording script exists; no video was recorded or uploaded. GitHub contributor/reporter reviewer/merge-admin synchronization remains future work, not part of the completed local workflow.

## Final learning checkpoint

Three interview questions: explain why a source archive needs Git history for base/candidate identity; explain why checking hashes alone does not establish application correctness; explain which startup/bootstrap steps were actually tested versus require external prerequisites.

Exercise: extract the archive in a separate folder, restore fixtures, inspect an original backend SQL predicate with read-only git show, and compare its accepted diff. Explain the two approvals, independent database evaluator, exact candidate identity and post-integration gate without looking at the model's summary. Then use the interview/debugging sheet to trace a stale approval and a duplicate vote. Do not reset or host-run the accepted shared fixtures.

Review the demo plan, disclosures and exercises before sharing. The implementation phases are packaged; external publication/video and future GitHub integration are separate work.
