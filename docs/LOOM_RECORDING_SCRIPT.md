# Loom recording: DevDesk prototype

Aim for about four minutes. Record your Chrome window, microphone on, camera optional. This presentation shows real completed model runs and current working previews. It is a review of retained evidence, not a replay of new model investigations or approvals during the recording.

## Prepare before pressing Record

On this configured machine the presentation schema is already prepared. Start it in a terminal:

```powershell
cd C:\AI_employee
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-LoomDemo.ps1
```

Open http://127.0.0.1:8115. Sign in as `asha` using the password from the accounts file inside the folder identified by `var/evidence/loom-demo-latest.json`. Open that local file before recording, then close it; do not show passwords/configuration files in the video. Open History: it contains frontend, backend and feature completions copied from real verified runs, with request IDs remapped only for viewing. Sources, actual candidate commits, model traces, approvals/votes/checks and integration evidence are retained. Main-workbench manual reports are untouched. No model calls were repeated. Do not start workers against this presentation schema.

Prepare Chrome tabs:

1. GitHub README: https://github.com/Jayadityas/DevDesk_AI_Employee
2. Demo Workbench: http://127.0.0.1:8115
3. Frontend: http://127.0.0.1:8081
4. Backend: http://127.0.0.1:8082
5. Completed-filter feature: http://127.0.0.1:8083

Keep Docker running. Set browser zoom to90% if needed for evidence. Keep only recording tabs visible and hide account files/notifications. You can read this script on another device or window outside the captured Chrome window. Before starting, rehearse opening a report, expanding its observation/repair trace, and scrolling to integration and feature votes. Avoid changing shared preview task data during rehearsal.

## Exact shots and narration

| Time | What to click/show | Suggested words |
| --- | --- | --- |
| 0:00–0:25 | GitHub README, then Workbench | “This is DevDesk, a C++ prototype that investigates controlled bug reports and feature proposals. It uses real model-selected tools and keeps source changes behind human approval and independent verification.” |
| 0:25–0:50 | Workbench New report form; show fields without submitting | “Employees can submit a bug or feature, describe expected behavior, provide reproduction steps and attach a screenshot. Requests, events and notifications persist in PostgreSQL. The separate Team Tasks playground uses SQLite.” |
| 0:50–1:50 | History → backend report → expand API observation; show scope, SQL diff, review and integration | “I’m showing a recorded successful Gemini investigation. The original To do filter incorrectly returned other statuses. The API evidence reproduced that behavior; source reading alone was not treated as proof. The reporter approved a scope limited to one C++ function. Gemini removed the incorrect SQL condition. All26 candidate checks passed. The reporter accepted that exact commit, and another26 checks passed after local integration before the ticket became COMPLETED.” |
| 1:50–2:10 | Backend tab → To do; briefly All tasks | “Here is the repaired running application. To do now shows only To do tasks. The evaluator independently compared API outputs with actual SQLite rows, including after task mutations.” |
| 2:10–2:35 | Frontend tab, Chrome device toolbar390×844; scroll to task buttons | “The frontend case repaired mobile action-button overlap. Both controls remain visible and usable; protected browser checks tested both mobile and desktop. This candidate passed20 checks before and after integration.” |
| 2:35–3:20 | Workbench History → feature report → scope, Feature vote, HTML diff and integration | “Features additionally need consensus over a fixed member snapshot. Four members need three yes votes; five would need four. This recorded poll passed with three authenticated synthetic yes votes. Scope approval and final candidate acceptance were still separate. Gemini added the missing Completed filter, and22 candidate and22 integrated checks passed.” |
| 3:20–3:35 | Feature tab → Completed | “The implemented Completed filter now shows only completed tasks while retaining the existing task controls.” |
| 3:35–4:00 | GitHub README links for architecture/limits/setup | “The control plane is C++20 with PostgreSQL; the UI is plain JavaScript and checks use Playwright. The live model was Gemini3.5 Flash Lite. Edited application code runs in Docker. The current scope covers these three capabilities, integration is local Git, and workers run while their terminal is open. Next I would add GitHub PRs with reporter review and a separate merge admin, then broaden capabilities and service deployment.” |

For a shorter video, show the report form, backend trace/fixed filter and feature vote/fixed filter; summarize mobile verification in one sentence. Do not claim that the approval clicks or inference are happening live if you are showing completed records. The submitted source uses Codex assistance; disclose that in the README/materials rather than presenting generated code as entirely unaided work.

## Loom Chrome extension clicks

1. Click the Loom extension in Chrome. Choose screen recording, microphone on, camera optional.
2. Choose a window capture that includes your Chrome window so switching demo tabs remains visible. Grant screen/microphone access when asked. The exact label varies with the recorder UI.
3. Start recording and follow the shot list. If a password window appears, pause before showing it.
4. Stop. Title the video **DevDesk — C++ AI Employee Prototype Demo**. Watch it once, verify readable evidence/audio and trim unnecessary pauses if needed.
5. Open sharing settings and choose the link-viewable option permitted by your workspace. Check the share link in a signed-out/private browser session so reviewers can view it.
6. Copy the `https://www.loom.com/share/...` link and send it here. It will be added near the top of the GitHub README and pushed using the existing update workflow. A local localhost URL is not an accessible reviewer demo.

Official guidance: [Loom Chrome extension recording](https://support.atlassian.com/loom/docs/get-started-with-the-loom-chrome-extension/), [sharing a recording](https://support.atlassian.com/loom/docs/share-your-recording/), [privacy settings](https://support.atlassian.com/loom/docs/use-looms-privacy-settings/). Workspace policy can restrict public/link sharing; verify access rather than assuming it.

## Submission checklist mapping

| Requested item | Where the reviewer finds it |
| --- | --- |
| Source link | GitHub repository |
| Setup/run | README and SETUP_AND_DEMO |
| Short architecture | ARCHITECTURE and README workflow |
| Technical decisions | SUBMISSION_OVERVIEW and phase guides |
| Demo | Loom link, added after actual recording |
| Known limitations | DISCLOSURES_AND_LIMITS |
| Next work | SUBMISSION_OVERVIEW and SPEC GitHub roadmap |
| Assumptions | SUBMISSION_OVERVIEW |
| Models/APIs/components/AI assistance | DISCLOSURES_AND_LIMITS |

The recorder must be started by you: there is no callable Loom control integration in this session. No video link exists until you actually record/share it.
