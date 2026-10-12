# Setup and run

Source: [GitHub repository](https://github.com/Jayadityas/DevDesk_AI_Employee). Demo: [Loom video](https://www.loom.com/share/398ea7183b0b483f863caeb1ef3ba4fb).

## Prerequisites

This implementation was tested on Windows with PowerShell, Git, Node24, installed Chrome, MSYS2 UCRT64 GCC16.2 and SQLite development files, PostgreSQL17 binaries/headers/libraries, and Docker Desktop's Linux engine. Build scripts use C:\msys64\ucrt64\bin\g++.exe and C:\Program Files\PostgreSQL\17; adjust trusted installation paths if necessary. Linux/macOS control-plane portability and a separate-machine clean installation are unverified.

The source includes vendored cpp-httplib/json headers and licences, a Playwright lockfile, playground history and assertion-only verification extracts. It excludes runtime credentials, accounts, databases, uploads, node_modules, compiled releases and Docker images.

## Fresh prepared workspace

Clone/extract into a writable directory and run these from its root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Restore-PackagedFixtures.ps1
npm.cmd --prefix .\tools ci
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Setup-DevDeskPostgres.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Configure-Model.ps1
```

Enter your Gemini key only in local var/config/model.json. Default provider/model is gemini / gemini-3.5-flash-lite. Local passwords and bootstrap credentials are generated, not supplied in the repository. Setup uses dedicated port5433 and preserves existing data. If another DevDesk installation owns5433, use that configured workspace or a separate machine/VM; do not initialize unrelated credentials against its cluster.

Build and verify the runner sequentially:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-RepairRunner.ps1
node .\trusted_checks\verify-runner.mjs frontend
node .\trusted_checks\verify-runner.mjs backend
node .\trusted_checks\verify-runner.mjs feature
```

Default restoration selects already accepted sources, so healthy application check sets contain20/26/22 assertions. The Docker build needs registry/package access. An existing configured machine can use Build-RepairRunner -UseVerifiedBase to reuse its verified image. This source distribution is not an offline dependency installer.

Start these in separate terminals and keep them open:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1
```

Open http://127.0.0.1:8094. Read the locally generated var/config/demo-accounts.json for lowercase usernames and passwords. Asha, Ravi, Maya and Noah are synthetic project members. Previews use8081/8082/8083. Workers poll only while their terminal remains open; restart them after a new release.

## Reproduce the demonstrated workflows

To create a new defect demonstration, choose Restore-PackagedFixtures.ps1 -Baseline in a separate prepared workspace before fixtures exist, then run each generic runner check with --baseline. These checks verify expected deliberate failures. Restoration preserves existing fixtures and does not reset accepted source. Model-edited application execution stays in Docker.

For the backend bug, report that To do shows tasks of other statuses at http://127.0.0.1:8082/. Compare /api/tasks?status=todo with /api/tasks?status=done. After investigation, prepare and approve the repair scope; inspect the candidate diff/checks; prepare its acceptance review and accept it. Completion requires integrated checks. Refresh the preview after activation.

For the feature, request a Completed filter at http://127.0.0.1:8083/. Prepare and approve its scope, then use three distinct eligible accounts to vote YES in the four-member roster. Return as the reporter to review and accept the candidate. Scope permission and consensus gate implementation; exact candidate acceptance gates integration.

Other archival test drivers reference historical local schemas and evidence directories. Use selected distribution/evidence reports to inspect their assertions; do not blindly replay them against already repaired fixtures. The linked Loom video shows the submitted prototype demonstration.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Incorrect login after changing workspaces | Use that workspace's new account file and lowercase username; browser autofill may retain old passwords. Five failed attempts trigger a five-minute process-local lockout. |
| Docker HTTP500/API deadline | Check/restart Docker Desktop, then retry the fixed preflight. Do not substitute host execution of edited application code. |
| Occupied ports | Preserve existing services; choose Start-Workbench -Port or stop only previews you own. |
| NEEDS_INFORMATION or REPAIR_BLOCKED | Inspect actual observations, denied actions, provider errors and check evidence. Do not treat these as completion. |
| Expired/stale scope or review | Obtain fresh investigation/scope/review as required; expired hashes do not authorize a change. |
| Feature poll remains OPEN | Keep workers running to reconcile deadlines; refreshing the UI is not a timer service. |
| Missing native release | Run Build-Workbench; Start-Workbench also builds if latest.json is absent. |

Keep local account/config/evidence directories private. A fresh external dependency install, new cluster and external image pull were not demonstrated on another machine.
