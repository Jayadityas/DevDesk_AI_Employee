# Explain and change the system yourself

Start with: “DevDesk investigates controlled bug/feature reports, records real evidence, obtains exact permission, edits a separate worktree, checks the candidate in Docker, waits for requester acceptance, and verifies the integrated source before completion.” Then distinguish synthetic demonstration actions from model-selected tools.

| Interview question | Answer outline / code pointer |
| --- | --- |
| Why SQLite and PostgreSQL? | SQLite keeps synthetic Team Tasks state simple; PostgreSQL supports workflow transactions, queue records, unique operations and locking. task_repository.cpp versus devdesk/db migrations. |
| Why RAII? | Resources/transactions release or roll back when a C++ scope exits, including exceptions. Statement, Result, Transaction and WorkerLease own different resources. |
| Why does Todo fail but Done work in the old backend? | Parameter-only OR ?1='todo' is true for every row when the filter is todo. See Phase7 truth table. |
| Why isn't a model's PASS enough? | Protected mandatory assertions verify actual behavior and identity; UNKNOWN/failure blocks candidate/completion. |
| Why candidate and integrated checks? | A correct task workspace does not establish behavior at the shared source after integration. |
| Why both scope approval and acceptance? | The first permits bounded implementation; the second permits one exact checked commit's integration. |
| How are votes counted? | Fixed roster, ceil(2N/3), authenticated immutable unique choices, deadline and early impossibility. consensus.cpp and migration008. |
| What happens after a crash? | Fencing/ownership, uncertain call retention and verified-journal reconciliation; ambiguous effects are not blindly replayed. |
| Why isolation despite allowlisted commands? | Edited native source/imports can execute code; command names alone do not constrain filesystem/network/process effects. |
| What remains for GitHub? | Provider integration, linked reviewers, commit/check/conflict invalidation, merge-admin notification and observed merged-main reconciliation. |

Practice in a separate source copy and fresh test schema; keep model-edited app execution inside the runner. Do not reset accepted shared fixtures.

1. **Priority rule:** locate request priority selection in routes.cpp. Explain P3 feature/cosmetic versus P2 unconfirmed functional impact; propose a changed tie-break rule and define an observable ordering test before editing.
2. **Add a read tool:** follow action_schema → provider branch schema → C++ validate_action → fixed investigation helper → persisted observation. Define typed args/output, scope, read-only effect, time and version; never add an unrestricted shell tool.
3. **Stale approval:** inspect an existing scope hash and expiry. In a private schema expire it, then call approve with the old hash; explain the409 and how fresh scope permission differs from replay.
4. **Failed browser check:** inspect baseline geometry/card facts, viewport, denied requests and script errors. Distinguish a missing feature from a layout failure; use relevant assertions rather than the screenshot alone.
5. **Duplicate write/recovery:** trace Idempotency-Key payload hashing, unique vote key and notification operation keys. Compare a safe identical replay with a conflicting request; inspect missing-journal BLOCKED behavior.
6. **Restart workers:** stop your own launcher, restart it and identify recovery before claims. Explain why waiting for approval/votes releases capacity and why ambiguous paid calls need explicit investigation retry.
7. **Threshold exercise:** in a private source/test copy change the formula experimentally, update the migration constraint and guard consistently, and show N4/N5 expected outcomes. Restore the required two-thirds rule before any demonstration or distribution; editing one expression alone does not change a valid contract.
8. **Explain the connector:** sketch the future GitHub review/admin/merge flow and identify the event that would authorize COMPLETED. A closed unmerged PR does not qualify.

Three final questions to answer aloud: where is edit authority enforced before a tool effect; what exact evidence turns a candidate into completed work; and which claims are proved by tests versus still limited? Exercise: trace the real feature IDs from the Phase8 guide through proposal → poll → repair → review → integration, identifying each required permission and failure state. Stop at the learning checkpoint after reviewing the packaged documentation; no guarantee of hiring or universal repair is implied.
