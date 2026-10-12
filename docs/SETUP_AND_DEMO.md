# Setup and a short demonstration

The current workspace is already configured. For normal use, keep Docker running and start these in two PowerShell terminals from `C:\AI_employee`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Workers.ps1
```

Workbench is http://127.0.0.1:8094. Previews are frontend8081, backend8082 and feature8083. Open `var/config/demo-accounts.json` locally for synthetic account credentials. Workers poll only while their terminal stays open; restart old terminals after a new build. Docker application builds/runs remain isolated. Main-workbench manual reports retain their existing states.

## Source package on a prepared Windows machine

The source archive contains control-plane source, fixed tooling, docs/licenses, selected assertion reports and a Git bundle for the clean playground plus the three accepted fixture histories. It deliberately has no keys, local accounts, databases, uploads, node_modules, native releases or Docker image. There is no public GitHub source URL yet; the local source archive is the current deliverable. Publishing it is a separate action.

Prerequisites observed in this implementation: Windows PowerShell, Git, Node24, Chrome, MSYS2 UCRT64 g++16.2 with SQLite headers/library, PostgreSQL17 binaries/headers/library at `C:\Program Files\PostgreSQL\17`, and a working Linux Docker engine. Compiler path is `C:\msys64\ucrt64\bin\g++.exe`. Exact observed libraries: cpp-httplib0.60.1, nlohmann/json3.12.0, Playwright1.64.0 (lockfile). Adjust installation paths in trusted build/setup scripts if needed. Linux/macOS control-plane portability is untested.

Extract into a writable local directory. For a fresh prepared machine:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Restore-PackagedFixtures.ps1
npm.cmd --prefix .\tools ci
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Setup-DevDeskPostgres.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Workbench.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Configure-Model.ps1
```

Enter your Gemini key only in the newly created local `var/config/model.json`. The default provider/model is gemini / gemini-3.5-flash-lite. Never paste the key in chat, a report, a commit or recording. Generated PostgreSQL credentials stay in local ignored files. Setup uses dedicated localhost5433 and preserves existing data; it does not configure the unrelated5432 server. If another DevDesk installation already owns5433, do not run a second setup with unrelated credentials against it: use the existing configured workspace or a separate machine/VM. Package bootstrap verification does not provision a second database cluster on this machine.

Build and verify the runner sequentially, then start Workbench/workers:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-RepairRunner.ps1
node .\trusted_checks\verify-runner.mjs frontend
node .\trusted_checks\verify-runner.mjs backend
node .\trusted_checks\verify-runner.mjs feature
```

Default restore selects the already accepted source, so healthy assertions are20/26/22. The first Docker build needs package/registry access. On the existing machine, `-UseVerifiedBase` can reuse its verified local image. This does not make the archive an offline dependency installer. A clean dependency installation, new-cluster initialization and fresh external image pull have not been demonstrated on a separate machine; Git restoration and the current configured startup were tested locally.

To reproduce original defects on a separate prepared workspace, choose `Restore-PackagedFixtures.ps1 -Baseline` before any fixtures exist. It restores original defect commits from the same bundle, without inserting repairs. Run the three `verify-runner.mjs` commands above with `--baseline`; they validate the expected deliberate failures before workers execute edits. Restoration always preserves existing fixtures; it never resets accepted shared source. Do not host-build/run accepted or model-edited fixtures using the historical developer launcher. Docker preview activation handles them.

## Five-minute recording plan

1. **0:00–0:40:** Explain the three components: Team Tasks playground, authenticated DevDesk workbench and bounded employee worker. Show the source map and current limitations.
2. **0:40–1:40:** Open the actual completed backend demo in a separate private browser session. Show read-only API failure evidence, proposed function scope, exact reporter approval, model SQL diff and26 passing candidate checks.
3. **1:40–2:30:** Show exact candidate acceptance, FINISHED integration,26 post-integration checks and COMPLETED history. Compare the fixed backend Todo preview with the original SQL predicate described in the Phase7 guide.
4. **2:30–3:40:** Show the completed feature demo: fixed roster4, threshold3, three authenticated synthetic YES votes, reporter scope approval, actual Gemini HTML diff and22 post-integration checks. Click Completed at8083.
5. **3:40–4:30:** Show the critical scenario matrix: unauthorized/stale decisions, duplicate votes/writes, rejection, recovery and containment. Distinguish deterministic tests from received live model decisions.
6. **4:30–5:00:** Disclose C++/JS stack, Gemini alias and estimates, Codex assistance, local Git, foreground workers and the future GitHub PR/reporter/admin design.

Use the exact completed-demo commands in the Phase7/Phase8 guides on a free port8105; only one such server should use that port at once. Show scope/vote evidence and assertions rather than account/config directories. The feature guide also points to an open-poll test schema for exploring authenticated controls. On a fresh archive these local demonstration schemas are absent: inspect the selected `distribution/evidence` reports, or create a fresh synthetic demo on a separate baseline workspace. Archival live drivers reference this machine's original evidence directories and are not generic fresh-archive setup commands.

Before recording, confirm that Docker previews are running, hide credentials/account files, use synthetic data and set Chrome to390x844 for mobile evidence. Rehearse once. No video was recorded or uploaded by the agent.

## Troubleshooting

| Symptom | Check/action |
| --- | --- |
| Docker HTTP500/API deadline | Check/restart Docker Desktop locally, then re-run the failed fixed preflight. Do not substitute host execution of edited apps. |
| Port8094/8081–8083 occupied | Preserve the existing service; choose `Start-Workbench -Port` or stop the specific preview you own. |
| Model needs information | Open the retained trace: provider errors, denied actions and unsupported conclusions are distinct outcomes. Provide missing report details or explicitly authorize fresh investigation. |
| Scope/review expired or source changed | Request fresh investigation/scope/review as appropriate; an old hash cannot grant current permission. |
| Poll still OPEN after time passes | Keep the worker launcher running; recovery reconciles deadlines. Refresh alone is not a timer service. |
| Latest build missing | Run `Build-Workbench.ps1`; Start-Workbench also builds when latest.json is absent. |
| New fixture absent | Run the package restore on a new extracted package; preserve existing sources. |

Keep whole local evidence/config directories private. Selected packaged reports contain assertions only; they do not transfer live account credentials or runnable database state.
