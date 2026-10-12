# Record new bug and feature workflows in one Loom video

This is a new live run, not the completed-history presentation. A separate original-defect workspace and empty test schema have been prepared; original accepted sources and manual reports remain unchanged. Ports8081–8083 temporarily show this workspace. Keep the original worker launcher stopped until recording is finished.

The fields below match the successful practice reports, including Local functionality impact for both requests. Practice used Asha, Ravi and Maya for its three YES votes. A fresh run repeats those inputs and approval gates; model responses, commits and elapsed time may vary.

For the Chrome extension, use **Pause** beside the Loom camera bubble and resume the same recording when the next result is ready. Loom documents these controls in [Pause and resume while recording](https://support.atlassian.com/loom/docs/pause-and-resume-while-recording). Show the submitted report before pausing; show reproduction evidence, approvals, candidate checks, votes and completion after resuming. Announce that waiting periods were omitted. Leave time for the final feature result rather than narrating every check.

## Before recording

1. In a PowerShell terminal, start the live Workbench:

```powershell
cd C:\AI_employee
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-LiveLoomWorkbench.ps1
```

2. Open http://127.0.0.1:8116. This is the live demo, not8115. Open the local accounts file indicated by `var/evidence/live-loom-latest.json`. It contains the new synthetic Asha, Ravi and Maya passwords. Sign in as each once and prepare browser password autofill if useful; return to Asha. Close account/config files before capture. All voters use this same Workbench/schema.
3. In a second PowerShell terminal, start the real workers:

```powershell
cd C:\AI_employee
$liveRoot = (Get-Content .\var\evidence\live-loom-latest.json -Raw | ConvertFrom-Json).directory
powershell -NoProfile -ExecutionPolicy Bypass -File "$liveRoot\tools\Start-LiveWorkers.ps1"
```

The queue starts empty. This worker uses your configured Gemini provider/key and normal typed tools, policy, checks and state machine. It makes actual model calls after you submit. Do not start the ordinary original-workspace worker simultaneously. Keep both terminals open.
4. Prepare Chrome tabs: live Workbench8116, backend8082, feature8083 and GitHub README. In the backend, To do should incorrectly show all four seed tasks. In the feature, Completed should be absent. The clean control-plane source and Linux evaluator are unchanged.
5. Start Loom capturing the Chrome window, microphone on. A complete uninterrupted two-workflow run may exceed a five-minute account limit. For one shorter video, pause **only during actual waits**, then resume to show state/results; say that waits were omitted. Do not replace live results with recorded screenshots or claim the entire elapsed runtime was five minutes. If fully uninterrupted capture is mandatory, use a recorder/account allowing a longer duration.

## Part 1 — submit and repair a backend bug

1. Show backend8082. Click To do and point out In progress/Completed cards in that filtered list.
2. In Workbench8116 as **Asha**, click New report. Enter:

| Field | Value |
| --- | --- |
| Request type | Bug report |
| Title | To do filter shows tasks with other statuses |
| Description | Selecting To do shows In progress and Completed tasks too. It should show only To do tasks. |
| Steps to reproduce | Select To do. Compare /api/tasks?status=todo with /api/tasks?status=done |
| Playground URL | http://127.0.0.1:8082/ |
| Viewport |390 ×844 |
| Impact |Local functionality, workaround available |

Screenshot is optional; attach an actual screenshot if you want to demonstrate upload. Click Submit report.
3. Show QUEUED/INVESTIGATING. During model waiting, pause Loom if needed. Click **Refresh records**, then **View report** to see current detail; detail does not stream automatically. Wait for **INVESTIGATED_READ_ONLY** and a reproduced conclusion. Expand API observation to show the failing status-filter assertion.
4. Click **Prepare repair scope**. Show `src/task_repository.cpp`, the limited list_tasks function scope, criteria/base/expiry. Click **Approve this source-change scope**. This first approval authorizes AI edits/checks. Show READY/IMPLEMENTING.
5. Pause only while the real repair runs. Refresh/View report until **CANDIDATE_READY**. Show **Live repair**, its actual model-call count, SQL diff, candidate commit and run_checks results. The AI has already edited a separate worktree and checked the candidate at this point; shared integration has not yet occurred.
6. Click **Prepare candidate acceptance review**, then **Accept candidate and authorize integration**. This second approval authorizes the exact candidate's integration. Show ACCEPTED/INTEGRATING if observable; fast transitions may be visible only in recorded events.
7. Wait/refresh until **COMPLETED** in History. Show FINISHED integration and26 passing post-integration assertions. Wait for the worker's preview activation, then reload backend8082 and click To do: only the two To do tasks should appear. If source is completed but preview still shows the old build, wait for preview activation rather than implying deployment has finished.

Suggested narration: “The AI independently reproduced the bug. I approved a bounded implementation scope. It generated and checked a candidate in isolation. I accepted that exact commit, then integrated verification gated completion.”

## Part 2 — submit a feature and perform real consensus voting

1. Show feature8083: there is no Completed filter. In Workbench8116 as **Asha**, submit:

| Field | Value |
| --- | --- |
| Request type |Feature request |
| Title |Add a Completed filter |
| Description |Add a visible Completed filter that shows only completed tasks. Preserve existing filters and create/advance/remove controls. |
| Steps |Open the feature playground; Completed is absent. |
| URL |http://127.0.0.1:8083/ |
| Viewport |390 ×844 |
| Impact |Local functionality, workaround available |

2. Wait/refresh for its read-only missing-feature assessment. Click **Prepare repair scope**. Show HTML navigation scope and the new OPEN feature poll: **four fixed members, three yes votes required**.
3. As Asha click **Approve this source-change scope**, then **Vote yes on this feature scope**. Show1/3; implementation must remain waiting.
4. Sign out. Sign in as **Ravi**, open the same feature report and vote YES. Show2/3; still waiting.
5. Sign out. Sign in as **Maya**, open the same report and vote YES. Show3/3 and PASSED. This is actual unique authenticated voting; scope approval was not an implicit vote.
6. Return to **Asha**, the reporter. The worker may now implement the authorized feature. Pause during actual model/check waits, then refresh/View report when CANDIDATE_READY appears. Show its actual HTML diff, commit and22 passing checks.
7. As Asha, **Prepare candidate acceptance review** → **Accept candidate and authorize integration**. Wait for COMPLETED/FINISHED integration. Show22 integrated assertions, reload feature8083 and click the new Completed filter.

Suggested narration: “The denominator is a snapshot of the four eligible project members. Three distinct yes votes are required; votes cannot be changed or counted twice. Consensus and reporter scope permission allow implementation, and exact candidate acceptance still gates integration.”

## Finish, share and restore

End with the stack and limits: C++20/PostgreSQL control plane, C++/SQLite playground, Gemini3.5 Flash Lite, fixed Node/Playwright checks and isolated Docker execution. Current integration is local Git; future work is the reporter-reviewed GitHub PR plus separate merge administrator, broader capabilities and a supervised background service.

Stop Loom. Watch the video and verify it shows actual new reports, actual model decisions/diffs, both approvals and three feature votes. Use a link-viewable sharing option and check access signed out. Send the real Loom link here to add it to the GitHub README.

After recording, stop the live worker and Workbench terminals with Ctrl+C. Restore the accepted original-workspace previews:

```powershell
cd C:\AI_employee
node .\tools\Switch-LiveLoomPreviews.mjs --restore
```

Then restart the original worker launcher if wanted. The restoration switches only owned preview containers; it does not roll back the live demo's new commits, delete evidence or reset accepted sources. Repeating the fresh live recording requires a new original-defect workspace/schema, not a reset of completed fixtures.

## Real failure behavior

- NEEDS_INFORMATION means no supported reproduction; inspect the actual trace and improve the report before explicitly requesting a fresh investigation.
- REPAIR_BLOCKED means no verified candidate. Inspect denied actions/checks/budget evidence; do not call that success in the video.
- DockerHTTP500 blocks execution. Pause recording, repair/restart the engine and recheck owned runtime before continuing. A restart does not authorize blind replay of uncertain writes.
- Scope/review windows and polls expire. Refresh and renew/reinvestigate as permitted; never use expired hashes. No response is not a yes vote.
- Check durations/model responses are variable. The prototype does not guarantee a live result within the Loom limit or on every attempt.
