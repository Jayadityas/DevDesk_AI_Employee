# Critical scenario coverage

The machine-readable index is verification-index.json. Its reports are historical, actual observations across different releases; Phase9 validates them and runs current Workbench/reliability/startup checks separately. Do not total these as independent model trials or present them as one simultaneous final-build run. Packaged distribution/evidence contains selected assertion-only extracts, not credentials or runnable schemas.

| Critical behavior | Evidence | Practical limit |
| --- | --- | --- |
| Screenshot report independently observed | frontend-live | Actual controlled browser observation; not a general image reasoning benchmark. |
| Mobile overlap fixed without hiding controls | frontend-live + frontend-runtime |20 browser/API assertions, actual unforced interactions. |
| Backend output independently verified | backend-live + backend-runtime |26 assertions; trusted SQLite reader, dynamic mutations. |
| No edit without reporter approval; other user denied | frontend-authorization, backend-authorization | Authenticated real API with explicit scripted decisions. |
| Exact candidate acceptance; rejection unintegrated | frontend-acceptance, feature-review | Candidate commit/evidence/hash/expiry bindings. |
| Completion only after integrated checks | frontend-acceptance, backend-live, feature-live | Local Git; not a GitHub merge observation. |
| Failed patch restored | failed-patch-rollback | Task checkpoint restoration; separate guarded integration rollback limits disclosed. |
| Concurrent submissions ordered; waiting work yields | current phase6 suite |27 reliability checks, fixed local capacity. |
| Refresh/restart preserve state and votes | feature-consensus, feature-recovery | Explicit journal crash fixtures plus actual server restart; not every instruction crash. |
| Duplicate requests/votes/notices do not duplicate effects | current phase2/phase6, feature-review | Unique keys plus transactional guards; not global exactly-once effects. |
| Stale base, approval, acceptance, scope/evidence denied | stale-base, backend-authorization, feature-review | Current exact identity required; revoked/stale consent cannot be reused. |
| N4→3 / N5→4, timeout and invalid votes | feature-consensus |44 contracts; no-response timeout and roster changes explicitly tested. |
| Rejected consensus in INVALID history/notified | feature-consensus | In-app notification and retained evidence. |
| Source/content cannot expand permissions | authorization suites + feature-consensus | Tested scope/typed action/file boundaries; no universal adversarial-content benchmark. |
| Evaluator protected; execution bounded | three runtime reports | Real mount/capability/timeout checks; backend UID/report/process canaries. |
| Budget/unsupported conclusion stops truthfully | Protected policy checks and retained local failures | Unknown billed usage remains unknown; no live exhaustion of every budget axis claimed. |

Demonstrated application cases: one frontend defect, one backend defect and one feature, each with a real Gemini candidate and verified local integration. Numerous earlier failed attempts are retained locally; three eventual completions are not a reliability success rate. Current healthy check sets contain20 frontend,26 backend and22 feature assertions. Models, costs and practical limits are documented in [disclosures](DISCLOSURES_AND_LIMITS.md). Selected assertion extracts are available in [distribution/evidence](../distribution/evidence); the index's original report paths refer to private historical runtime evidence.
