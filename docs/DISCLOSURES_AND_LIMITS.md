# Implementation disclosure and demonstrated limits

Codex assisted with implementation, tests, troubleshooting and documentation. The human selected C++, the provider/model, workflow requirements and phase progression. The actual repair candidates in the three demonstrated application scenarios were produced by Gemini through recorded tools, not selected from a production patch lookup. Synthetic test drivers performed human approvals/votes/acceptances through real authenticated APIs; they did not approve the user's manual reports.

| Component | Actual choice |
| --- | --- |
| Control plane | C++20, MSYS2 UCRT64 GCC16.2.0; Windows CNG authentication, WIC image handling, WinHTTP provider transport |
| HTTP/JSON | Vendored cpp-httplib0.60.1 and nlohmann/json3.12.0; MIT licenses included |
| Playground | C++ HTTP/API, SQLite, plain HTML/CSS/JavaScript |
| Workflow persistence | Dedicated PostgreSQL17.11 at localhost5433, restricted application role |
| Tool/evaluator orchestration | Node24.11.1; Playwright1.64.0, installed Chrome on Windows, Chromium in the fixed Linux image |
| Edited app execution | Linux Docker, read-only source/container restrictions, bounded resources/time; backend app/evaluator UID separation |
| Live provider | Gemini generateContent, user-selected gemini-3.5-flash-lite alias; strict typed action schema and trusted C++ validation |
| Alternative provider | OpenAI adapter exists; this final demonstration used Gemini. No claim of equivalent final live verification for OpenAI. |
| Repository integration | Local Git2.47.1. No GitHub connection, PR publication or external email. |

Model aliases can change. The actual locally saved receipts identify model, prompt version, calls and usage; estimates use configured rates and are not provider billing. Successful historical backend demonstration estimated$0.012053; successful historical feature demonstration$0.011157. Earlier failed investigations and incomplete usage remain in local evidence. Unknown billing is not zero billing; no overall success percentage or whole-project cost is claimed.

Current capability boundaries: frontend CSS mobile overlap, backend list_tasks body/status filtering and Completed-filter HTML navigation. Playground schema/data migrations and arbitrary feature/code repair are not supported. Permission is bound to scope/base/profile/hash/expiry; candidate acceptance binds a checked commit. Candidate checks and integrated checks are separate. COMPLETED requires successful integration evidence, never a model statement alone.

Isolation tests demonstrate specific filesystem, UID, capability, mount, network and timeout restrictions. They are not a proof against every native exploit or networking technique. Recovery includes an actual lease-holder kill plus explicit abandoned/crash records; not every paid-inference or merge instruction was interrupted. Failed-patch rollback was tested; post-merge rollback fault evidence includes an explicit private-clone Docker failure seam rather than a real failing post-merge container in every case. Exact scenario coverage is in the verification matrix.

Workers are a foreground terminal poller, not a Windows service. Single-host/project ownership is supported; distributed exactly-once effects are not claimed. Controlled browser/API origins use synthetic data. Account model is a local demonstration, not enterprise identity/production authorization. A fresh dependency installation/cluster and external Docker build were not verified on a separate machine. Native Windows control-plane paths remain installation-dependent.

Future GitHub requirement is recorded: contributor creates per-report PR, linked reporter reviews current commit, required checks and conflict status gate notification to a separate merge admin; only observed merge to main produces COMPLETED. Those automated product integrations are not installed or connected. The source repository has been published at https://github.com/Jayadityas/DevDesk_AI_Employee using the separate submission workflow. The [submitted Loom video](https://www.loom.com/share/398ea7183b0b483f863caeb1ef3ba4fb) is linked in README. No hosted application deployment was published.
