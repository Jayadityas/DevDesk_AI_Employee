# Phase 6: ownership, cancellation and restart recovery

The C++ control plane now gives one active worker capacity for the shared playground. Waiting for scope approval or candidate acceptance does not hold that capacity. A restart reconciles durable records before claiming another job. It does not automatically repeat an uncertain model request, source patch, merge or rollback.

## Files and functions

| File | Responsibility |
| --- | --- |
| `devdesk/db/005_reliability.sql` | Cancellation flags, run ownership, scope snapshots, successive proposal revisions, global lease row and database transition fencing. |
| `devdesk/db/006_preview.sql` | Preview audit records; separate migration also covers installations that already applied 005. |
| `devdesk/src/reliability.hpp/.cpp` | `WorkerLease` owns the database advisory lock, exclusive Windows file handle, lease heartbeat and helper capability. `ensure` checks authority; `attach` binds a run; `bind_job` passes the fixed capability to trusted helpers. `reconcile_work` preserves interrupted evidence, expires authority and inspects integration journals. |
| `tools/control-contract.mjs` | Helpers check token, monotonically increasing fence, schema and expiry before effects. Cancellation markers are scoped to schema and ticket. |
| `devdesk/src/worker.cpp`, `repair.cpp`, `integration.cpp` | Claim, tool and completion boundaries use the lease. Candidate review checks current clean Git identity, checked CSS and the repair's original scope snapshot. |
| `devdesk/src/routes.cpp`, `devdesk/static/app.js` | Requester cancellation, explicit reinvestigation, duplicate-effect guards and UI controls. Source integration already in progress cannot be cancelled as though its effect never happened. |
| `tools/investigation-helper.mjs` | Fixed read-only GET retries: at most three attempts for transport errors or 502/503/504. Other statuses are not retried. Every attempt checks ownership. Inference is never automatically retried. |
| `tools/repair-helper.mjs` | Check ownership before source writes; label evaluator containers with their owner; recovery removes only matching owned containers. `reconcile_integration` reads current source and protected verification evidence without Git writes. |
| `devdesk/runner/runtime-build.mjs` | Fixed application build inside the restricted container; source fingerprint matches the Windows helper convention. |
| `devdesk/runner/preview.mjs`, `preview-relay.mjs`, `tools/preview-helper.mjs` | Build and run the accepted source inside an internal-network container. A separate trusted relay has no source/data/credential mounts and publishes only localhost. It forwards fixed task routes, strips credentials and cannot select another upstream. The app's external-network probe must fail before readiness. |
| `tools/Start-Workers.ps1` | Continuous terminal launcher: recover, integrate, activate preview, investigate, repair. Human approval and acceptance still gate source changes. |

## Contracts and tradeoffs

The PostgreSQL advisory lock provides normal mutual exclusion. The exclusive Windows file handle prevents another process taking capacity merely because an old worker lost its database connection. The global row records a new fence for each owner, with a 120-second expiry and heartbeat every five seconds. The protected local capability lets fixed helpers reject stale work immediately before a write. Database ticket transitions involving active worker states also require the matching session token and fence.

These guards favor blocking over guessing when ownership is uncertain. They are scoped to this single Windows playground, not a distributed multi-host scheduler. A request racing an already authorized operation cannot undo an effect that has crossed its boundary; cancellation stops subsequent work. Uncertain provider billing remains unknown. A healthy lease cannot prove an interrupted operation never happened.

Waiting tickets cancel immediately and keep their records. Active investigation/repair tickets set `cancel_requested`, remain in their active state and display a pending message. The worker or recovery acknowledges `CANCELLED`; helper markers block further source-changing actions. Repeating cancellation creates one event and one notification. A requester can explicitly authorize a fresh investigation from supported blocked/read-only states; this is a new operation, not replay of a previously uncertain call.

Expired scopes become `STALE` and tickets return to read-only investigation. A new scope must match the current investigated baseline and receive fresh approval. Expired or changed candidate acceptance becomes `STALE`; the ticket returns to `CANDIDATE_READY`. Preparing acceptance also checks the repair scope snapshot, Git parent, clean checkout, allowed-file diff and checked CSS hash.

Interrupted investigation/repair becomes `INTERRUPTED` with evidence retained. A `STARTED` provider receipt without a durable response makes usage incomplete. Interrupted integration reaches `COMPLETED` only when a protected `VERIFIED` journal, all twenty named PASS checks, expected CSS and the current clean Git commit agree. Missing/ambiguous evidence becomes `INTEGRATION_BLOCKED`; recovery does not repeat the merge or blindly revert shared source.

The preview container receives only the current source read-only and a dedicated writable copy of synthetic task data. The original database is preserved. Preview processes have a 30-minute bound; the launcher adopts a healthy matching pair or recreates its own expired pair. Metadata is activated only after live commit/build identity and isolation readiness pass. Windows could not reach a port on the internal Docker network directly, so a separate fixed relay provides ingress. The relay has bridge connectivity; editable application code remains exclusively on the internal network. No host compilation of model-edited application code occurs.

## Real trace and verification

The reliability test submits three reports concurrently using real authentication and PostgreSQL. Requester cancellation persists once. An explicitly seeded interrupted investigation includes a `STARTED` decision. A real C++ lease holder is killed, another worker obtains a larger fence, and recovery marks the interrupted run with incomplete usage without a model call. A stale helper cannot create its checkout. Waiting approval/acceptance records yield to the next READY repair; that scripted selection test has no proposed patch and cannot claim a successful repair. Shared source remains at accepted commit `4945512e8e8d07ca6901a1581bc1363d2cbc7254`.

The integration test reuses the actual Phase 5 verification journal `5ccec08da5757a15976c94164dc94ebe` in a fresh database schema. It recovers completion without changing Git, then proves a missing journal produces a blocked outcome. These are explicit database crash fixtures, not a claim that a paid model process was killed during inference.

Evidence paths and final results are recorded in `BUILD_STATUS.md`. Failed attempts remain in `var/evidence`: a missing submission key in the new test, concurrent preview/lease test contention, a missing-journal receipt initialization error, differing Docker missing-network wording, intermittent Docker HTTP 500, and internal-network ingress timeouts. The fixes do not turn those attempts into successful tests.

Final results: 27 reliability, 5 journal recovery, 4 transport-seam, 10 live preview and 10 actual runtime checks PASS; the runtime includes all 20 application assertions PASS. Final workbench regression: 95 PASS. The 12-second empty-schema launcher ran three cycles/eleven children, reused the preview and stopped cleanly; it preceded the final preview-audit/message fix, whose behavior passed the final reliability suite. No new model inference requests occurred. Source edited by Gemini remains the real accepted Phase 4/5 candidate.

## Commands and manual walkthrough

Run from `C:\AI_employee` with Docker Desktop running:

```powershell
powershell -ExecutionPolicy Bypass -File tools/Start-Workbench.ps1
powershell -ExecutionPolicy Bypass -File tools/Start-Workers.ps1
```

Keep both terminals open. Workbench defaults to `http://127.0.0.1:8094`; frontend preview uses `http://127.0.0.1:8081`. Existing occupied ports are preserved. Stop an older launcher before starting this release. No automatic Windows login startup or background service has been installed.

1. Sign in with your locally stored demo account; submit a report and watch its investigation evidence and notification.
2. Open a waiting report and select **Cancel this report**. Refresh: its evidence remains and repeated cancellation does not duplicate effects.
3. During investigation/repair, cancellation first displays a pending message; wait for worker acknowledgement. Integration already in progress rejects cancellation.
4. On a supported blocked/read-only report, **Request a fresh investigation** explicitly queues another operation. It can incur new model usage.
5. Review current scope and exact candidate evidence through the existing approval and acceptance buttons. Expired records require fresh authorization.
6. Stop/restart the launcher. Recovery runs before new claims; inspect recorded outcomes. Do not manually reset an interrupted integration to ACCEPTED to force replay.

Independent checks:

```powershell
node trusted_checks/phase6-runtime.mjs
node trusted_checks/phase6.mjs
node trusted_checks/phase6-integration-recovery.mjs
node trusted_checks/phase6-retry.mjs
```

Run worker-capacity tests sequentially, without a competing launcher. Fresh-schema tests preserve manual reports. The runtime prerequisite temporarily resets/pins verification when the image is rebuilt; it must pass before source-changing execution.

## Limits and learning checkpoint

Not demonstrated: killing a paid Gemini inference request, killing the integration process at every possible instruction, a multi-host lease protocol, arbitrary backend-code isolation, interactive Ctrl+C under every Windows shell, or GitHub PR synchronization. Existing twenty application assertions cover the frontend CSS repair scope. Future backend execution needs its own isolation review. Container cleanup can fail when Docker is unavailable; the evaluator's bounded timeout remains the fallback, rather than claiming cleanup succeeded.

Three interview questions:

1. Why do an advisory lock, a heartbeat row and a fence solve different problems? Explain the additional Windows file handle.
2. Why must an interrupted model call not be automatically retried, and what evidence can justify recovering a completed integration?
3. Why does a ticket waiting for acceptance consume no worker capacity, and why is `cancel_requested` different from `CANCELLED`?

Exercise: in a fresh test schema, expire an approved scope, run recovery and identify the stale proposal, read-only ticket and single notification. Explain why simply extending its old deadline would not be a valid renewal.

Next is Phase 7: reuse the same runtime for the seeded backend defect, introducing only the scoped capabilities and independent output checks actually required. Pause at this learning checkpoint before starting it.
