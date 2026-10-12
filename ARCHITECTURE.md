# DevDesk architecture

DevDesk is a modular C++20 control plane with separate foreground workers and an isolated application execution environment. PostgreSQL stores workflow state; a separate C++/SQLite Team Tasks playground is the repair target.

## Components

| Component | Responsibility |
| --- | --- |
| devdesk/src/routes.cpp | Authentication, reports, evidence, scope approval, candidate review and history APIs |
| devdesk/src/support.cpp and image.cpp | RAII database transactions, parameterized queries, authentication primitives and bounded screenshot handling |
| devdesk/src/provider.cpp and worker.cpp | Provider transport, typed model actions and read-only investigation |
| devdesk/src/repair.cpp and repair_profile.hpp | Scoped implementation, candidate worktrees and verification |
| devdesk/src/consensus.cpp | Fixed-roster feature polls and immutable authenticated votes |
| devdesk/src/integration.cpp and reliability.cpp | Guarded integration, leases, fencing, cancellation and recovery |
| devdesk/db | PostgreSQL migrations and durable workflow records |
| devdesk/static | Plain HTML/CSS/JavaScript Workbench |
| tools and devdesk/runner | Fixed tool helpers, container execution and preview relays |
| trusted_checks | Independent policy, workflow, browser/API and runtime checks |
| playground | Separate C++/SQLite application, restored from distribution/playground.bundle |

## Request and repair flow

1. An authenticated submission transaction records the request, queued investigation, linked ticket, event and in-app notification. Operation keys and payload hashes guard duplicate submissions.
2. A worker independently observes the permitted browser/API origin and reads relevant source. Gemini proposes typed actions; trusted C++ validates them. Observations and decisions are persisted. Unsupported or unconfirmed reports can become NEEDS_INFORMATION.
3. The reporter requests a versioned repair scope and approves its permitted file/function, criteria, base and expiry before edits. Features also require a PASSED poll with ceil(2N/3) YES votes from a fixed eligible-member snapshot.
4. The repair worker creates an isolated Git worktree. The model generates bounded patches and invokes fixed Docker checks. Candidate identity, diff, evidence and commit are retained.
5. The reporter accepts an exact candidate review bound to scope, commit, evidence and expiry. Rejection does not authorize integration.
6. Integration verifies current authority, source identity and a clean shared checkout before guarded local Git integration. Post-integration checks gate COMPLETED, History and a notification. Failure or uncertainty cannot be reported as success.
7. Preview activation builds/runs accepted source inside Docker and updates the corresponding localhost preview. Preview availability can lag source completion.

## Persistence and ownership

PostgreSQL stores employees, project membership, requests, tickets, observations, decisions, approvals, repair steps, candidate reviews, integration journals, feature polls/votes, events and notifications. Restricted runtime roles and transactions protect durable records. Database advisory locks, a Windows ownership handle, heartbeats and fencing serialize the supported project capacity; this is a single-host design.

SQLite belongs to each synthetic playground instance. It keeps application data separate from workflow and credentials. No application schema/data migration capability is implemented.

## Execution boundary

Workbench, worker, permissions, prompts and evaluator are protected from model edits. Editable application source is limited by registered profiles. Model-edited code builds and runs in a fixed Linux Docker image with bounded time/resources, restricted mounts, non-root execution and network restrictions. The backend evaluator and application use separate UIDs to protect result files and independent database observations in the tested cases.

Protected Node/Playwright helpers provide browser/API evidence and independent checks. The model cannot invoke an unrestricted shell or expand its own authority. Immutable native releases bind runtime components; exact source/commit identities bind checks and human decisions.

Recovery reconciles known journal states and expired authorities. Ambiguous writes or paid calls are not blindly replayed. These controls do not establish distributed exactly-once execution or complete protection against every native exploit.

## Current boundaries and decisions

C++ matches the builder's preferred language and supports explicit RAII resource ownership. PostgreSQL provides transactional workflow/queue coordination; SQLite keeps the small playground independent. Fixed tools and independent checks make model claims reviewable. Separate scope permission and exact candidate acceptance prevent broad or stale approval from authorizing a different change.

The registered scenarios are mobile button overlap, backend status filtering and a Completed filter. Workers require an open launcher terminal. Integration is local Git; automated GitHub PR creation, reporter review, merge-admin notification and merged-main observation are planned. See [setup](docs/SETUP_AND_DEMO.md), [verification](docs/VERIFICATION_MATRIX.md) and [disclosures](docs/DISCLOSURES_AND_LIMITS.md).
