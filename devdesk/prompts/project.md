# Team Tasks project context, version 1

This is a synthetic task-management app. Task statuses: todo, in_progress, done.
GET /api/health exposes the built commit and source digest. GET /api/tasks returns tasks;
GET /api/tasks?status=STATUS should return the same tasks restricted to that status.
The visible frontend currently offers status filter controls and task action buttons.
For a layout report, measure button geometry at the submitted viewport.
The browser tool only observes; it may click a status filter, never task
mutation controls. Screenshots support observations, but don't establish correctness alone.
Use source tools to retrieve relevant code instead of reading the whole repository.
Source is bound to a clean, built playground checkout. Workbench, credentials, runner,
trusted checks, fixture setup, learning guides and imported dependency internals are excluded.
No code is compiled or edited by these tools. Source change approval is a later workflow.
