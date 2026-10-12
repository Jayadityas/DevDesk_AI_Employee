# DevDesk product scope

DevDesk is an AI-assisted software-maintenance workbench for synthetic employee bug reports and feature proposals. The implemented prototype investigates controlled reports, obtains bounded permission, generates and verifies a candidate, and completes work only after human acceptance and successful integration checks.

## Supported capabilities

| Scenario | Controlled origin | Permitted implementation | Required application assertions |
| --- | --- | --- | --- |
| Mobile task-button overlap | localhost:8081 | Scoped frontend CSS | 20 |
| Incorrect To do filtering | localhost:8082 | Backend list_tasks function body in src/task_repository.cpp | 26 |
| Missing Completed filter | localhost:8083 | Plain filter buttons in static/index.html navigation | 22 |

The original defects and missing feature are explicit fixtures. Model-generated patches are real; there is no production table mapping defect IDs to repair patches. Other repositories, arbitrary features and application migrations are outside current scope.

## Workflow requirements

- Authenticated employees submit title, description, reproduction steps, allowed playground URL, viewport, reported impact and an optional bounded screenshot.
- Persist requests immediately with deterministic provisional priority and deduplicated events/notifications. A screenshot or reporter assertion alone does not establish reproduction.
- Investigate read-only and retain source/browser/API evidence. Report missing information or failed/unknown observations truthfully.
- Publish a versioned source scope; require reporter permission before implementation. Bind permission to scope, profile, base identity and expiry.
- Features additionally require ceil(2N/3) authenticated YES votes from a fixed roster: four members need three, five need four. Votes are unique and immutable; no response is not approval. Timeout or impossible consensus closes unsuccessfully with retained history.
- Implement only the approved scope in an isolated worktree. Protected checks must establish a candidate against exact source identity.
- Require reporter acceptance of the exact checked candidate before guarded integration. Rejection, stale authority, dirty source, conflicts and failed/unknown checks block progress.
- Mark COMPLETED only after successful integration and post-integration verification; retain evidence and deliver an in-app notification.
- Respect cancellation and project ownership. Reconcile known recovery journals without replaying ambiguous effects.

## Deployment and assumptions

The prototype uses one Windows host, a dedicated PostgreSQL cluster, configured synthetic users, controlled localhost origins, a locally configured Gemini key and a working Linux Docker engine. Workers poll while their foreground launcher remains open. Application execution stays inside the fixed runner; runtime configuration, passwords, uploads, databases and builds are excluded from source distribution.

## Next development

Connect DevDesk as a GitHub contributor that creates per-report PRs and requests the reporter's review. Notify a separate merge administrator only after current approval, passing checks and conflict checks. Complete requests only after observing an actual merge into main; closing an unmerged PR is insufficient. Add supervised background workers, broader independently verified capabilities, monitoring and cross-machine setup validation.

See [architecture](ARCHITECTURE.md), [setup](docs/SETUP_AND_DEMO.md) and [limitations and components](docs/DISCLOSURES_AND_LIMITS.md).
