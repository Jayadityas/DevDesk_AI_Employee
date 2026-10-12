# DevDesk specification decisions

## Phase 9 handoff

Package the implemented local capabilities as source plus Git history, selected noncredential assertion reports and documented setup/demo/limits/AI disclosure. Current setup/regressions and actual extracted Git bootstrap are verified separately from a clean external-machine installation. No secret/account/database/upload/runtime-build distribution, host execution of edited application code, public publication or new live inference is implied. Source archive is the local deliverable; a public source URL, recorded video and future GitHub connector require separate actions. Preserve the final learning exercises. See docs/PHASE9_PACKAGING_GUIDE.md.

## Phase 8 implemented scope

The Completed-filter feature at controlled port8083 uses the shared runtime after a published scope and fixed snapshot of all active project members. Exact threshold ceil(2N/3), immutable authenticated unique votes, deadline and early impossibility govern consensus. Both reporter scope approval and matching PASSED consensus are required for READY. Expiry/insufficient consensus moves to INVALID history with persisted notification; no response is not approval. Current implementation capability permits only plain filter buttons inside static/index.html navigation, preserving existing markup; scripts, other files and storage changes are denied. Exact candidate acceptance and all22 post-integration checks still gate COMPLETED. Consensus is checked during repair, candidate decisions, integration and journal recovery. Feature preview joins the accepted frontend/backend previews at8083. Real Gemini demonstration completed in a fresh test schema; main manual reports were preserved. Other features need a separately reviewed capability. GitHub PR integration and Phase9 remain unimplemented. Evidence and learning checkpoint: [Phase 8 guide](docs/PHASE8_FEATURE_GUIDE.md).

## Phase 7 implemented scope (historical checkpoint)

Backend reports use the same bounded investigation/approval/repair/acceptance/integration machinery with a protected backend profile. Source edits are limited to the body of TaskRepository::list_tasks in src/task_repository.cpp; schema, seed, signatures and other functions remain outside this approval. Mandatory backend verification compares actual API outputs with independently read SQLite rows, including after mutations. Model-edited C++ executes only inside the verified unprivileged Docker runner. Reporter approval precedes edits; exact candidate acceptance precedes local integration; 26 passing post-integration assertions precede COMPLETED. The real Gemini demonstration completed in a separate test schema; manual workbench reports remain preserved. Frontend/backend Docker previews activate accepted source at ports 8081/8082. Feature consensus and GitHub PR synchronization have not started. Full evidence and learning checkpoint: [Phase 7 guide](docs/PHASE7_BACKEND_GUIDE.md).

## Phase 6 and future GitHub direction

Phase 6 uses one Windows project capacity with database/file ownership, heartbeat/fencing and safe-boundary cancellation. Waiting human decisions release capacity. Recovery preserves uncertain model/patch/Git operations rather than replaying them; exact verified journals can recover completion. Expired or changed authority requires fresh review. Preview deployment builds accepted code only inside Docker and uses a trusted, mount-free localhost ingress relay.

User-requested future GitHub workflow: DevDesk contributes a per-report branch and PR to the actual Playground repository, requests review from the reporter's linked GitHub account, and runs required checks. Notify the merge administrator only when the reporter has approved the current commit, required checks pass and the PR has no conflicts. New commits invalidate old approval/check readiness. Contributor and merge-admin privileges remain separate. Only an observed successful merge into main makes the corresponding workbench ticket COMPLETED; an unmerged closed PR must not do so. Retain source-change scope approval before implementation. This future integration is recorded, not implemented or connected in Phase 6; current acceptance/integration remains local.


Phase 3 implementation update: read-only model adapter and investigation loop are implemented, but live Gemini verification passed. Allowed tools are project instructions, scoped tracked source list/read/search, controlled GET API/browser observation and evidence-bound finish. No source changes, approvals, polls or completion. Selected model is gemini-3.5-flash-lite; configured limits are 12 actions/calls, 300 seconds, 200,000 tokens and $0.50 estimated usage. These are application budgets, not an exact wall-clock kill or provider billing cap; ambiguous usage is visibly incomplete. Browser observation uses the report viewport. See docs/PHASE3_INVESTIGATOR_GUIDE.md for implemented versus unverified behavior.

Design checkpoint: 10 October 2026. Authoritative source: DevDesk_Codex_Build_and_Learning_Instructions.md. Deadline: 12 October 2026, 11:59 PM IST. This document clarifies the plan; it does not override that source.

## Phase 5 implementation update

Candidate acceptance/rejection is requester-only and binds commit, scope, mandatory evidence and expiry. Accepted candidates may be integrated only against clean expected shared source. Actual post-integration checks gate completed history and notification. One continuous terminal launcher is implemented; automatic Windows login startup was not requested. The real Gemini candidate completed the synthetic source-integration demonstration. Existing preview snapshots are not automatically redeployed. Later Docker failures do not invalidate earlier successful checks; they block new execution. Full evidence and unverified limits: docs/PHASE5_ACCEPTANCE_GUIDE.md.

## Phase 4 implementation update

CSS-only frontend scope proposals, reporter approval, separate worktrees and bounded repair actions are implemented and demonstrated. Normal execution requires a pinned runner with successful containment verification; actual probes, failed-patch rollback and a real model-driven candidate loop passed. Explicit patch-only fallback must remain unverified (`PATCH_ONLY` / `REPAIR_BLOCKED`), with no candidate commit or completion. Limits: three patches, twelve actions/calls and elapsed-time checks between operations; the fixed container timeout is separate. Final candidate checks bind source digests and both viewport screenshots. Shared integration and completion remain Phase 5. Full contracts and verification: docs/PHASE4_REPAIR_GUIDE.md. Earlier Phase 3 statements describe that phase's boundaries.

## Product and boundaries

Build a bounded software maintenance employee for synthetic Team Tasks data. Three components: a repairable playground, authenticated employee workbench, and durable decision worker with an isolated runner. Support one responsive-layout defect, one backend status-filter defect, and one small voted feature. No arbitrary repositories, production access, real email, destructive migrations, self-modification, or claims of universal correctness.

First delivery priority is a complete frontend bug loop through requester acceptance and integrated checks. Then recovery/concurrency, backend reuse, feature voting, packaging. Phase estimates will follow actual setup progress; no promise that every phase fits the deadline.

User-approved stack revision: C++20 replaces Python for backend and worker because the user is more comfortable understanding and modifying C++. Frontend remains HTML/CSS/JavaScript; browser tooling uses JavaScript Playwright. Phase 2 now uses PostgreSQL 17.11/libpq for the control plane. Phase 1 uses SQLite for the small playground and each synthetic preview, avoiding credential coupling and using the installed compatible C++ library; this does not replace control-plane concurrency guarantees. See ARCHITECTURE.md for working versions and portability limits. This explicitly supersedes the original document's recommended Python stack, while preserving its product and authority requirements.

## Proposed fixtures and independent checks

Each scenario starts from its own clean, versioned baseline and fresh synthetic database. Fixture controls are developer-only, clearly labeled, and disabled during repair. They introduce defects but contain no repair patches or defect-to-fix mapping. Trusted expectations stay outside model context and writable source.

- Clean data: tasks A and B are todo, C is in_progress, D is done. Titles and IDs are fixed by evaluator fixtures.
- Frontend fixture: introduce card action layout that overlaps at 390x844. Verify nonintersecting action rectangles, visibility, click behavior, and unchanged task content at 390x844 and 1280x800. Save baseline/candidate screenshots and commit/build identity. Baseline must fail the relevant assertion.
- Backend fixture: status=todo incorrectly returns all tasks. Independent API checks require precisely A/B for todo, C for in_progress, D for done, all four for no filter, and a validation error for unsupported status. UI regression checks remain required.
- Feature baseline: API filtering works for every status, but UI exposes only All, Todo, In progress. Proposal adds a Completed option showing only D, plus an empty-result message and persistence of existing task actions. This is independent of the broken API fixture.

Confirm these fixtures at the Phase 1 checkpoint before repair behavior is built.

Implemented Phase 1 fixture details: task IDs 1/2 (A/B) are todo, 3 (C) in_progress, 4 (D) done. phase1-clean is the clean source tag. fixture/frontend adds a mobile-only action positioning rule with 40px horizontal intersection; fixture/backend introduces the incorrect todo-query condition; fixture/feature uses clean source with the Completed UI control absent. Worktrees are under var/fixtures, data is separate under var/data, and developer-only ResetData replaces rows only after its server is stopped. No fixture action repairs source. Exact source commits and builds are retained in each check report. These fixtures remain subject to the user's Phase 1 learning review.

## Deterministic priority policy

Validate project, reproduction, affected action, observed scope, workaround, and data-loss evidence. Store provisional and confirmed classification separately, with policy version, rule ID, reason, and evidence references. User assertions alone cannot promote to P0/P1.

| Rule | Objective confirmation | Priority |
| --- | --- | --- |
| loss-or-outage | Trusted check confirms lost persisted task data or create/list unavailable across supported fixtures | P0 |
| broad-core | Trusted checks confirm core task workflow fails at both supported viewports or all relevant status cases, without workaround | P1 |
| local-functional | Functional failure limited to a status or supported viewport, with recorded workaround | P2 |
| cosmetic-or-feature | Geometry defect with usable controls and no lost function, or approved enhancement | P3 |

Unconfirmed impact remains provisional and cannot override confirmed queue ordering. Frontend cosmetic fixture maps to P3; wrong-status output with All plus manual inspection as workaround maps to P2. A disabled essential action must be reclassified based on evidence. Queue sorts eligible tickets by confirmed priority, submission UTC timestamp, stable ID. Starvation mitigation is future work.

Phase 2 implementation has no confirmed reports: validated cosmetic/feature submissions are provisional P3 (`provisional-v1-low`); other validated reported impacts are provisional P2 (`provisional-v1-unconfirmed`). P0/P1 and repair eligibility remain gated on later trusted observations/authority. Submission inserts the queued investigation record before its linked ticket, with request/event/notification in the same transaction; it does not invent a baseline observation. History currently retains only requester-withdrawn QUEUED reports; completion/rejection/invalid outcomes require later migrations and actual workflows.

## Authorization and voting

Reporter alone approves a bug's versioned scope before edits. Approval binds base commit, files/actions, criteria, risk, expiry, and limits. Acceptance is separate and binds exact candidate, scope, evidence run, requester, and expiry. Material scope changes renew authorization; candidate changes invalidate acceptance.

Feature polls snapshot active eligible IDs. Immutable yes/no votes, unique poll/employee constraint. Threshold is ceil(2N/3), N>=1. Default proposed deadline: 30 minutes, displayed and configurable. Resolve transactionally at threshold, when remaining votes cannot reach it, or at deadline. Nonresponses count as nonapprovals. Failed consensus becomes INVALID/insufficient_consensus with retained history and notification. Passing poll authorizes only its displayed scope; candidate acceptance is still required.

## Limits and prerequisites

Initial proposed budgets: 3 patch attempts, 2 safe transient-read retries, 1 schema repair, 40 actions, 20 model calls, 15 active minutes, 60 seconds per ordinary command, 120 seconds per build/check. Token and monetary caps must be set after actual provider pricing/access verification, before a live worker runs. Stop repeated unchanged actions; never blindly retry ambiguous writes.

Gemini provider and ignored local credential are configured. GET access and a complete live image/structured investigation passed. Keep keys out of chat and future task containers. Configuration is var/config/model.json; screenshot input was accepted, but visual reasoning accuracy has not been benchmarked.

Docker CLI exists but engine is unavailable. Before Phase 4 demonstrate containment, timeout cleanup, denied host/secret access, and restricted egress. If unavailable, restrict to report/patch-only behavior and label execution incomplete. WSL alone is not demonstrated isolation.

Gemini provider update: user selected gemini-3.5-flash-lite. Native Google generateContent requests use responseJsonSchema for one action, PNG/JPEG inline input and x-goog-api-key over fixed-host TLS. C++ policy checks remain authoritative. Gemini parser rejects incomplete/multiple candidates, unexpected model identity and inconsistent usage; non-input tokens conservatively include thinking. A GET models probe verifies generateContent support before inference. Configuration now selects provider gemini and rates $0.30 input/$2.50 output per million tokens (Google standard pricing); the $0.50 application estimate remains. Stable model aliases may evolve and are not immutable dated snapshots. OpenAI remains supported as an alternative. Live Gemini verification passed; the credential remains local and ignored. Official references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/pricing .



## Final Phase 3 verification — 11 October 2026

Implementation and live verification are complete; pause at the learning checkpoint. Build 070f5268e483b7889cfe1327737d8076fc1f500cb9745e54778c826991226a8a, investigation-v4, Gemini gemini-3.5-flash-lite. Final live report var/evidence/phase3-live-2026-10-11T13-15-55.785Z-87240/report.json: 8 PASS/0 FAIL, 36.266 seconds. Six model decisions: project instructions -> source list -> static/styles.css read -> API observation -> Chrome observation -> evidence-cited reproduced conclusion. Browser measured 1,360 pixels² overlap at 390x844; screenshot was saved and visually inspected. Source/data identity stayed unchanged. Run FINISHED; ticket INVESTIGATED_READ_ONLY, never COMPLETED. No source edit/approval/repair/integration occurred.

Live usage: 25,165 input and 679 output tokens (conservative thinking-inclusive count), estimated $0.011152 for the successful run. Earlier pilot receipts total an additional $0.016399 estimated; the first timed-out request's billing is unknown, so the complete session total is not established. Stable model alias is not an immutable dated snapshot. Accepted screenshot requests demonstrate input transport, not a visual reasoning benchmark. Failures exposed schema/prompt weaknesses; typed tool variants and prerequisite schema gating fixed the demonstrated path without bypassing policy.

Final same-build checks: 20 C++ self-checks PASS; Phase 3 scripted report var/evidence/phase3-2026-10-11T13-16-13.258Z-41412/report.json: 59 PASS/0 FAIL, 80.488 seconds; Phase 2 regression var/evidence/phase2-2026-10-11T13-16-13.656Z-98936/report.json: 95 PASS/0 FAIL, 20.790 seconds. Test servers were cleaned by their launchers; existing user workbench PID 115708 and frontend PID 21624 remain running. Existing PostgreSQL was preserved. Native HTTPS required approved execution outside the tool sandbox. No credential was printed.

Full map, commands, trace, manual walkthrough, three interview questions and learning exercise are in docs/PHASE3_INVESTIGATOR_GUIDE.md. The final live schema/tool changes were retested; repeated tests are now unnecessary absent a new change. Unverified: broad model reliability, live backend/feature scenarios, actual crash during billed inference, interactive Ctrl+C, Linux portability and arbitrary-code isolation. Scripted recovery used an abandoned record. Phase 4 must demonstrate repair isolation before any model-edited code execution and add explicit source-change approval. Do not interpret this read-only success as permission to edit source; wait for the user's continuation after learning.

