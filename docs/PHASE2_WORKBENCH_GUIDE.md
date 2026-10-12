# Phase 2: the workbench and durable records

Implemented and verified 11 October 2026. This guide describes the current code, not the future worker.

## What this phase adds

Employees can sign in, submit a bug or feature proposal with an optional screenshot, see the shared project queue, inspect real recorded events, withdraw their own queued report, read retained history, and mark their own notifications read. Refresh and application restart preserve these records.

Submission creates an investigation **record**, not an investigation result. It is queued and unconfirmed. The ticket is linked after that record exists, in the same transaction. Nothing has reproduced the report, approved a patch, edited source, voted, or completed a repair.

## Folder structure

```text
C:\AI_employee\
  playground\                  Existing separate, repairable Git repository; unchanged
  devdesk\                     Protected workbench source, outside playground
    src\
      main.cpp                 CLI modes, database construction, local HTTP server
      support.hpp              Shared types and RAII contracts
      support.cpp              Cryptography, libpq queries/results, synthetic seed
      image.cpp                Windows WIC raster decoding and image limits
      routes.cpp               Authentication, validation, authorization, domain/API flow
    db\001_initial.sql         Trusted migration: tables, constraints, initial project
    static\
      index.html               Login, report form, queue/history/notification/detail panels
      app.js                   Fetch/session handling, operation keys, safe DOM rendering
      styles.css               Desktop/mobile workbench layout
    third_party\               Independent copies of pinned HTTP/JSON headers and licenses
    .clang-format              Consistent, readable C++ formatting
    build\                     Ignored executable, DLLs, frozen assets, build digest
  tools\
    Setup-DevDeskPostgres.ps1   Own local cluster, trusted migration and restricted role
    Build-Workbench.ps1        GCC/libpq/Windows library linking and asset snapshot
    Start-Workbench.ps1        Setup/seed, port check and owned-process cleanup
    Setup-Phase2Test.ps1       Fresh test schema; preserves manual demo data
  trusted_checks\phase2.mjs    Independent API, SQL and real Chrome checks
  var\                         Everything here is ignored, not source or model context
    config\
      postgres-admin.json     Local bootstrap credentials; never runtime/model input
      workbench.json          Restricted runtime connection and upload location
      demo-accounts.json      Synthetic login passwords; open locally only
    postgres-data\             Dedicated PostgreSQL cluster and server log
    uploads\                   Original manual-demo screenshots
    evidence\phase2-*\         Isolated test records/config/uploads/accounts/report/PNGs
```

The workbench uses **C++20**, just like the playground. The UI and Playwright checks use JavaScript. No Python service is involved. `devdesk` is protected by its placement outside the permitted playground checkout; an actual worker/runner enforcing that scope is still future work.

## Why PostgreSQL here and SQLite in the playground?

Each playground preview needs only its own small task database. SQLite provides that without database accounts or a separate service.

The control plane coordinates shared employees, tickets, request keys, events, and eventual worker claims. PostgreSQL provides transactions, row locks, unique constraints, and separate database roles for this shared authority. Phase 2 already uses a row lock to prevent duplicate effects across two API processes. SQLite could support the first single-process workbench with less setup, but would postpone testing the intended shared coordination and role boundary.

There are two PostgreSQL listeners on this machine: the pre-existing server on **5432**, which this phase did not configure, and our own cluster on **5433**. Runtime credentials use `devdesk_app`; setup uses `devdesk_admin`; `devdesk_owner` owns schema objects and cannot log in. The runtime has table SELECT/INSERT/UPDATE and sequence usage, but no administrative capabilities, table creation, TEMP creation, ticket deletion, or audit-event UPDATE. Credentials exist only in ignored local files and child-process environment/input, not command arguments or reports.

## Source reading order

1. `main.cpp`: read `main`. `--seed config accounts` is developer setup, not an HTTP route. `--serve config port static` opens PostgreSQL and mounts the compiled asset snapshot. Four HTTP threads serve only `127.0.0.1`.
2. `support.hpp`: `Result` owns a `PGresult`; `Database` owns a `PGconn`; `Transaction` begins immediately and rolls back unless `commit()` succeeds. Exceptions do not leave a partial submission transaction open.
3. `support.cpp`: `Database::query` uses `PQexecParams`. Report text is bound data, never concatenated SQL syntax. The only concatenated schema identifier comes from trusted configuration and passes an identifier regex. `Result::json` exposes database scalars as strings and SQL NULL as JSON null; the frontend therefore compares IDs as strings.
4. `routes.cpp`: `install_routes` registers handlers; `guarded` serializes use of one connection and translates validation/domain errors into HTTP responses. `body`, `text_field`, and `integer_field` validate allowed keys, types, byte limits, and ranges before writes. `authenticate` checks the persisted session; `membership` checks project access.
5. `image.cpp`: `decode_image` requires complete PNG/JPEG markers, a successful native decoder, one frame, valid dimensions, and a full RGBA pixel decode. It does not infer whether the screenshot proves a bug.
6. `app.js`: `api` sends the CSRF token on writes, `session` restores identity, `refresh` reads durable records, `detail` displays ticket/evidence/events, and the report submit listener manages upload and request replay. `node` assigns `textContent`; report text is never inserted as HTML.

## API interfaces

| Method and path | Behavior and authority |
| --- | --- |
| POST `/api/login` | Synthetic username/password; returns HttpOnly SameSite cookie |
| GET `/api/me` | Current identity, CSRF token, eligible projects |
| POST `/api/logout` | Requires session/CSRF; revokes server-side session |
| POST `/api/uploads` | Session, CSRF, membership; one multipart `screenshot` |
| GET `/api/uploads/:id` | Upload owner, or project member after attachment |
| POST `/api/requests` | Session, CSRF, membership, validated fields and Idempotency-Key |
| GET `/api/tickets?view=queue` | Project-member queue ordered by priority, time, ID |
| GET `/api/tickets?view=history` | Project-member retained withdrawn reports |
| GET `/api/tickets/:id` | Project-member ticket and actual events |
| POST `/api/tickets/:id/cancel` | Requester only, queued withdrawal; replay has no new effects |
| GET `/api/notifications` | Current employee's persistent notifications |
| POST `/api/notifications/:id/read` | Notification owner only; persistent read receipt |

All authenticated writes require `X-CSRF-Token`. Browser writes from another origin are rejected; Host must match the exact loopback workbench host and port. The cookie expires after eight hours and the database expiry/revocation is checked on every request. Passwords use Windows CNG PBKDF2-HMAC-SHA256, 600,000 iterations and independent random salts. The session database stores SHA256 of a 256-bit random token, not its raw cookie value. Five failed logins for a username impose a five-minute process-local throttle.

This is local HTTP, so the cookie deliberately lacks Secure for localhost development. HTTPS and a Secure cookie are required for a deployed version. No production authentication, password recovery, external identity provider, or durable distributed login throttle is claimed.

## Database records and one real trace

`employees`, `projects`, and `memberships` establish synthetic identity/project access. `sessions` holds expiry/revocation. `uploads` stores owner, randomized filename, MIME, original byte count/hash, and decoded dimensions. `requests` preserves reported fields and operation-key/payload-hash uniqueness. `investigations` preserves queued/unconfirmed state. `tickets` links request/investigation and stores provisional policy. `events` and `notifications` retain actual submission/withdrawal actions and acknowledgements.

The final Chrome check submitted a report with the frontend fixture's Phase 1 screenshot:

1. The submit listener in `app.js` sent multipart evidence to `/api/uploads`. `authenticate` and `membership` ran first. `decode_image` inspected PNG bytes and decoded all pixels. A random filename was written outside the web root and metadata inserted. Browser-provided path names were discarded.
2. The listener sent validated report JSON with its generated Idempotency-Key and upload ID to `/api/requests`.
3. The handler validated kind, text, project, viewport, reported impact and URL. Allowed playground origins are exactly `http://127.0.0.1:8080` through `:8083`; external/userinfo URLs are rejected. Reporter identity came from the session, not the body.
4. `Transaction` began; `SELECT ... FOR UPDATE` locked the reporter row. Existing operation keys were checked before attachment availability, so a successful report could be safely replayed with its already-bound screenshot.
5. New request, queued investigation, linked QUEUED ticket, submitted event and acknowledgement notification were inserted. Cosmetic impact produced P3 and rule `provisional-v1-low`.
6. `commit()` completed before returning HTTP 201. Chrome displayed ticket #9, its original screenshot, the actual submitted event, and “Awaiting investigation”. This was in the fresh test schema, not the manual demo.

A same-key/same-canonical-payload retry returns the original ticket with HTTP 200 and `replayed: true`. Same key with different report data returns 409. The database constraint and employee row lock protect creation across processes, not merely browser memory. A forced notification-insert failure returned 500 and left request/investigation/ticket/event counts unchanged, proving rollback. Uploading is a separate operation; failed submissions may leave an owned, unattached image rather than deleting original evidence.

## Deterministic provisional priority

| Validated input | Current provisional priority and rule |
| --- | --- |
| Feature proposal or cosmetic report | P3, `provisional-v1-low` |
| Local functionality, core workflow or reported data loss | P2, `provisional-v1-unconfirmed` |

P0/P1 require independent confirmation or authorized review, which does not exist in this phase. A feature's P3 is a proposal classification, not an approved enhancement. Queue visibility is not repair eligibility. No source-edit endpoint exists.

## Run and manual walkthrough — PowerShell

From `C:\AI_employee`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
```

The launcher starts the dedicated database if stopped, reapplies the idempotent initial migration/grants, seeds without rotating existing passwords, and starts the workbench at **http://127.0.0.1:8094**. Port 8090 was already occupied by an unrelated process; it was left running. A busy chosen port gives an explicit error; use `-Port` to select another. `-Build` rebuilds after source changes. Ctrl+C invokes owned-child cleanup; the bounded `-RunForSeconds 2` path was actually verified. Interactive Ctrl+C has not been exercised by this agent.

In another local terminal, open the synthetic passwords without sending them into chat:

```powershell
notepad .\var\config\demo-accounts.json
```

1. Sign in as `asha` using that local file. The manual queue starts empty; test reports live in separate schemas.
2. Click **New report**. Choose bug, title “Buttons overlap on mobile”, describe expected separate controls, enter reproduction steps, URL `http://127.0.0.1:8081/`, viewport 390 × 844, and cosmetic impact. Optionally attach your screenshot or the retained `frontend-390x844.png` under Phase 1 evidence.
3. Click **Submit report**. Expect an acknowledgement, a provisional P3 ticket, original evidence and a submitted event. Investigation remains queued/unconfirmed.
4. Refresh the page. The ticket remains. Open **Notifications** and mark the acknowledgement read.
5. Sign out and sign in as `ravi` in another browser profile. Ravi may read project tickets and attached evidence, but cannot withdraw Asha's report. `outsider` has no project access.
6. Sign back in as Asha, open the ticket, and click **Withdraw queued report**. It leaves Active queue and appears in History with evidence/events intact. No report deletion happens.
7. Stop and restart the workbench. The same session (until expiry), records and read receipts remain.

Rebuild and run independent checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Workbench.ps1
node .\trusted_checks\phase2.mjs
```

Checks require the dedicated database running and `tools/node_modules` from Phase 1. On a newly prepared environment run PostgreSQL setup first and `npm.cmd --prefix .\tools ci`. Test output under `var/evidence` includes local credentials/config; share only the redacted `report.json` and PNGs, not the whole directory.

After stopping workbench/checks, stop only our PostgreSQL cluster if desired:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Setup-DevDeskPostgres.ps1 -Stop
```

At this handoff all owned preview processes and the dedicated database are stopped. The next normal launcher starts the database again. Tool-sandbox process restrictions required approved native startup/stop; a normal local PowerShell terminal is the intended manual environment.

## Actual verification

Final report: `var/evidence/phase2-2026-10-11T08-06-58.042Z-2132/report.json`; latest pointer `var/evidence/phase2-latest.json`. **95 PASS, 0 FAIL, 12.274 seconds**, zero model calls. Build SHA256 identity `3241fad332872d032de0294d3ac40a49e694489973b146e1069c0f8c67429b72`. GCC 16.2.0; PostgreSQL/libpq 17.11; existing cpp-httplib 0.60.1, nlohmann/json 3.12.0, Playwright 1.64.0 and installed Chrome.

Observed checks cover auth/expiry/logout/CSRF/origin, project and screenshot ownership, PNG/JPEG/full decoding/size/dimensions, randomized filename/path handling, original-byte preservation, field/URL validation, provisional policy, three distinct concurrent submissions, six identical submissions across two API processes, event/notification uniqueness, withdrawal/history, private notifications/read receipts, role limits, refresh/restart, safe text rendering, mobile overflow, real browser submission, and forced transaction rollback. Desktop/mobile PNGs were saved and visually inspected. All owned preview processes were stopped. The documented bounded launcher succeeded on 8094; launch on occupied 8090 exposed a conflict and motivated explicit port checking. Earlier failed runs remain retained, including the import-library failure and a corrected browser timing assertion.

Phase 1 source/fixtures were not changed; its 176-assertion suite was not rerun. WSL/Linux builds, interactive Ctrl+C, production auth, browser accessibility audit, resource/load testing, and model/worker/repair/approval/voting/integration were not run or implemented.

## Limits and design tradeoffs

One mutex-protected libpq connection serializes API database work, including password verification. This is intentionally small and inspectable; connection pooling and more granular synchronization need measured load and transaction tests. This is not a throughput claim.

The current migration permits only QUEUED/CANCELLED ticket states and queued/cancelled investigations. Future worker migrations must add their real states; no fake completed history exists. Withdrawal supports queued reports only; cancellation during active worker effects belongs to Phase 6. Notifications are transactional in-app records, not emails or an external delivery dispatcher. No automatic background investigation, votes, patch approval, source tool or completion button exists.

Windows CNG and WIC make this implementation Windows-specific. The existing PostgreSQL import library works with this observed MinGW toolchain; linking directly to its DLL did not. Containers/Linux will need explicit portability adapters and verification. The cluster consumes normal PostgreSQL resources; no local model was downloaded.

Unattached uploads, old sessions and test schemas are retained without automatic garbage collection. The app is localhost-only with synthetic accounts; ignored files are not a secure deployment secret store. UI maxlength counts characters while API text bounds UTF-8 bytes. Known fixture origins are fixed in trusted validation. Queue starvation mitigation and future repair eligibility are not implemented. Safe execution isolation remains an unresolved Phase 4 gate.

## Interview practice and exercise

1. **Why one transaction?** Trace five linked records, acknowledgement included; explain rollback and the forced-failure test. Image upload is deliberately separate, so file retention has a different lifecycle.
2. **Why does retry not create another ticket?** Explain canonical payload hash, authenticated employee + operation key, row lock across processes, unique constraint and notification effect keys. A changed payload is a conflict, not a silent overwrite.
3. **Why does “data loss” not become P0 immediately?** A report is untrusted evidence; trusted code owns priority and source authority. Observations/confirmation come in Phase 3, approval/repair later.

Exercise: submit cosmetic and local-functional reports and explain why the latter sorts first even if submitted second. Then inspect `install_routes` around `lower`, `priority`, `rule` and `reason`, change one provisional explanation in your workbench source, rebuild with `-Build`, and confirm a **new** ticket stores the new explanation while an existing ticket retains its original record. Explain why changing already-recorded priorities needs a separate audited transition.

Phase 3 preview: add the read-only employee and a verified model-provider adapter, scoped source retrieval/browser/API observations, actual baseline evidence, and persisted tool results. No source edits yet. Model access/capabilities must be verified before claiming a live autonomous investigation. Stop at this Phase 2 learning checkpoint and reply **continue** when ready.
