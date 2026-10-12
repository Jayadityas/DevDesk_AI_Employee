# Phase 1: folder map, code reading and hands-on backend debugging

Prepared 11 October 2026 (IST) from the current workspace. Phase 2 remains paused for learning. This guide does not change application source or repair a fixture.

## How to read this guide

Read the folder map, request flow and backend truth table first. Then read the line tables in this order: Task/TaskRepository header, repository implementation, routes, main, HTML, JavaScript, CSS, launch/build/fixture scripts, checks. Every physical line of our application, scripts and evaluator has its source and explanation below, including braces and blank separators. Manifests, ignore rules and generated build headers are also covered.

The third_party headers and tools/node_modules are imported library implementations, not code authored for this app. Their tens of thousands of internal lines are not individually annotated here; the dependency section explains exactly which APIs we use and where their source lives. Executable/DLL/database/PNG files are binary artifacts, so they have roles rather than source-code lines. Existing Markdown files are documentation, not executable code.

Line numbers refer to this snapshot. The original sources are linked in each table. After your own edits, reopen the source to locate symbols if numbers shift. Recorded source SHA256 values make that distinction explicit.

## 1. All Phase 1 folders and files

~~~text
C:\AI_employee\
├── DevDesk_Codex_Build_and_Learning_Instructions.md  active user blueprint
├── SPEC.md, ARCHITECTURE.md                         scope and current/roadmap design
├── BUILD_STATUS.md, LEARNING_LOG.md                 actual results and teaching notes
├── README.md                                       setup, launch and reproduction commands
├── .gitignore                                      future parent-repo exclusions
├── docs/
│   └── PHASE1_CODE_GUIDE.md                         this learning reference
├── playground/                                     separate repairable Git repository
│   ├── .git/                                       Git objects/history/index/branches
│   ├── .gitignore                                  excludes builds and task DB files
│   ├── README.md, DEPENDENCIES.md                   app and dependency disclosures
│   ├── src/
│   │   ├── main.cpp                                program setup and HTTP lifetime
│   │   ├── routes.hpp, routes.cpp                   HTTP interface, validation and JSON
│   │   └── task_repository.hpp, task_repository.cpp persistence interface and SQL
│   ├── static/
│   │   ├── index.html                              DOM/template/form/filter structure
│   │   ├── app.js                                  fetch, render, events, status cycle
│   │   └── styles.css                              responsive layout/appearance
│   ├── third_party/
│   │   ├── httplib.h, httplib.LICENSE               downloaded HTTP library/license
│   │   └── json.hpp, json.LICENSE                   downloaded JSON library/license
│   └── build/                                      generated, ignored outputs
│       ├── unity.cpp, build_identity.hpp            generated compilation inputs
│       ├── team-tasks.exe                           compiled C++ server
│       ├── libsqlite3-0.dll, libwinpthread-1.dll     required dynamic runtimes
│       ├── build-info.json                          commit, digest, compiler, timestamp
│       └── static/                                 served copies of the three assets
├── tools/                                          developer tooling outside repair repo
│   ├── Build-Playground.ps1                         compiles a selected source checkout
│   ├── Start-Playground.ps1                         selects data/source, owns preview
│   ├── Initialize-Fixtures.ps1                      introduces source defects once
│   ├── package.json, package-lock.json              pinned browser-check dependencies
│   └── node_modules/                               installed Playwright and core/bin files
├── trusted_checks/
│   └── phase1.mjs                                  independent API/browser assertions
└── var/                                            generated local data; ignored
    ├── data/                                       manual clean/backend/etc. SQLite DBs
    ├── fixtures/
    │   ├── frontend/                               fixture/frontend source + own build
    │   ├── backend/                                fixture/backend source + own build
    │   └── feature/                                fixture/feature source + own build
    ├── evidence/                                   reports, screenshots and fresh test DBs
    │   ├── latest.json                             pointer to most recent test report
    │   └── <run-id>/                               report.json, 8 PNGs, scenario DBs
    └── setup/                                      disposable setup/smoke-test artifacts
~~~

Each fixture repeats playground's src/static/third_party/docs/build layout. Its .git is a small pointer file into playground/.git/worktrees, not a full independent copy of Git history. Worktrees share history/objects but have separate checked-out files, indexes and branches. Do not edit .git metadata manually. Other copied source files match the clean baseline; the variant lines are explained at the end of this guide.

The root workspace has no initialized control-plane repository yet. No devdesk API/worker folders exist. tools and trusted_checks are outside playground now; future runtime permissions must actually protect them before repair execution is enabled. Folder placement alone is not a sandbox.

Useful inspection commands in PowerShell:

~~~powershell
Set-Location C:\AI_employee
git -c safe.directory=C:/AI_employee/playground -C .\playground worktree list
git -c safe.directory=C:/AI_employee/playground -C .\playground status --short
Get-Content -LiteralPath .\var\evidence\latest.json
~~~

## 2. What runs where

HTML/CSS/JavaScript runs in Chrome. C++ runs as the local team-tasks.exe process. SQLite stores rows in a file used by that process. Node/Playwright drives the browser only during checks. PowerShell prepares/builds/starts the app; it is not the app's request handler.

~~~mermaid
flowchart LR
  U[Human clicks a filter] --> J[app.js loadTasks]
  J --> H[GET /api/tasks?status=todo]
  H --> R[C++ guards and GET route]
  R --> T[TaskRepository::list_tasks]
  T --> Q[Prepared SQLite SELECT]
  Q --> V[vector of Task rows]
  V --> O[JSON tasks array]
  O --> D[Browser renders cards]
~~~

The GET performs no database mutation. POST creates a row; PATCH updates only its status; DELETE removes a row. --seed transactionally replaces synthetic rows and resets their sequence, then exits. ResetData is a developer launcher switch that calls this mode; it never restores source code.

## 3. Read the backend defect as a predicate

Open [backend task_repository.cpp](/C:/AI_employee/var/fixtures/backend/src/task_repository.cpp:60). The clean query in [playground](/C:/AI_employee/playground/src/task_repository.cpp:60) is:

~~~sql
SELECT id,title,description,status,created_at
FROM tasks
WHERE (?1 = '' OR status = ?1)
ORDER BY id;
~~~

The seeded backend fixture instead uses:

~~~sql
SELECT id,title,description,status,created_at
FROM tasks
WHERE (?1 = '' OR status = ?1 OR ?1 = 'todo')
ORDER BY id;
~~~

?1 is the single request parameter bound by query.text(1, status). The bare SQL name status is the current row's column. The C++ variable also called status holds the request filter; these are different things even though their spellings match. All occurrences of ?1 refer to the same bound value.

| Request filter | ?1 = '' | Per-row status = ?1 | Added ?1 = 'todo' | Returned rows in defective fixture |
| --- | --- | --- | --- | --- |
| No filter (bound empty string) | true | irrelevant | false | All rows, intentionally |
| todo | false | depends on row | true | All rows, incorrectly |
| in_progress | false | true only for matching rows | false | Matching rows only |
| done | false | true only for matching rows | false | Matching rows only |

For todo, even the done row satisfies false OR false OR true. For done, the extra term becomes false and the expression is effectively status = 'done'. The defect is a row-independent OR condition making the WHERE predicate always true for one requested value. It does not change stored statuses, and valid_status correctly accepts both values. HTTP 200 only indicates request handling succeeded; it does not establish correct filtering.

Seed data is exactly: ID 1 todo, ID 2 todo, ID 3 in_progress, ID 4 done. To do's expected answer is 1/2. Done's expected answer is 4. Backend baseline returns 1/2/3/4 for todo and 4 for done. The UI renders the returned array without an extra frontend filter, so the same error is visible in the browser.

The eventual source correction is removing only the added OR ?1 = 'todo' term. Keep the no-filter branch and row comparison; returning a fixed pair of IDs would be a hard-coded answer, not a reusable filter. I have left the fixture unchanged for your own exercise.

## 4. Reproduce before editing

Terminal 1, PowerShell, from C:\AI_employee (stop any existing backend scenario first):

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-Playground.ps1 -Scenario backend -Port 8082 -ResetData
~~~

ResetData replaces this manual scenario's synthetic rows. Open http://127.0.0.1:8082 and click To do: all four seed cards appear, including In progress and Completed. The dedicated Completed UI filter is absent by design; inspect done directly through the API.

Terminal 2:

~~~powershell
$todoResult = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/api/tasks?status=todo'
$todoResult.tasks | Select-Object id,title,status
$doneResult = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/api/tasks?status=done'
$doneResult.tasks | Select-Object id,title,status
~~~

Expect IDs 1,2,3,4 for the first command and only 4 for the second. In Chrome F12 -> Network, click To do and inspect the GET URL and response; it will show the same rows. This distinguishes a backend response bug from a wrong browser label.

## 5. Make your own change while preserving the demo baseline

Use a separate learning worktree based on the broken backend branch. These are instructions for you; I have not executed them or changed a fixture.

~~~powershell
Set-Location C:\AI_employee
New-Item -ItemType Directory -Force -Path .\var\exercises | Out-Null
git -c safe.directory=C:/AI_employee/playground -C .\playground worktree add -b learning/backend-fix C:/AI_employee/var/exercises/backend-fix fixture/backend
~~~

Run creation once. If branch/path already exists, inspect and reuse your work rather than deleting it. Open C:\AI_employee\var\exercises\backend-fix\src\task_repository.cpp and remove only the added term on line 60. Save. Use git diff to see the single intended change:

~~~powershell
git -c safe.directory=C:/AI_employee/var/exercises/backend-fix -C .\var\exercises\backend-fix diff -- src/task_repository.cpp
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-Playground.ps1 -Source C:\AI_employee\var\exercises\backend-fix
~~~

The default build command builds clean playground. Passing Source is essential to compile your changed learning worktree. Stop any previous learning executable before rebuilding it; Windows locks a running exe. Rebuilding copies frontend assets into this worktree's build/static.

Use a separate synthetic database and port for your experiment, in its own terminal:

~~~powershell
& .\var\exercises\backend-fix\build\team-tasks.exe --db C:\AI_employee\var\data\backend-learning.db --seed
& .\var\exercises\backend-fix\build\team-tasks.exe --db C:\AI_employee\var\data\backend-learning.db --static C:\AI_employee\var\exercises\backend-fix\build\static --port 8084 --scenario backend
~~~

Do not reseed that database while its learning server is running. The label still says backend, but behavior comes from your newly compiled source. In a second terminal:

~~~powershell
(Invoke-RestMethod 'http://127.0.0.1:8084/api/tasks?status=todo').tasks | Select-Object id,status
(Invoke-RestMethod 'http://127.0.0.1:8084/api/tasks?status=done').tasks | Select-Object id,status
(Invoke-RestMethod 'http://127.0.0.1:8084/api/tasks?status=in_progress').tasks | Select-Object id,status
(Invoke-RestMethod 'http://127.0.0.1:8084/api/tasks').tasks | Select-Object id,status
~~~

Now expect 1/2, then 4, then 3, then all four. Also open http://127.0.0.1:8084 and click To do. Preserve the original backend at 8082 if you want a side-by-side comparison.

The Phase 1 suite targets the original four baselines, not this custom learning worktree. It deliberately expects the original backend's filtering failure; patching that original fixture makes its baseline-match check fail even though the behavior has improved. Do not weaken trusted expectations to hide that distinction. Future repair verification will separately expect a candidate to pass correctness checks.

After an uncommitted edit, HEAD commit stays the same but the file digest changes on rebuild. Keep your diff alongside the new build record. A later committed candidate needs its own commit; this exercise is not an accepted/integrated DevDesk repair.

## 6. Practical reading notes

- .hpp declares interfaces and types; .cpp defines behavior. Header includes make declarations visible; linking supplies library implementations.
- Task is a plain value object. TaskRepository owns the SQLite handle and operation mutex. Statement borrows the connection but owns/finalizes a prepared statement.
- std::optional<Task> distinguishes an ordinary missing ID from a storage exception. std::lock_guard releases its mutex automatically, including on exceptions. Copying these ownership wrappers is disabled.
- JSON shape/type/enum/length validation happens before SQL. Bound values cannot turn an apostrophe into query syntax. The SQL predicate can still be logically wrong, as this fixture demonstrates.
- GET returns arrays through a JSON object; POST returns one object with 201; PATCH returns an updated object; DELETE returns 204 without JSON. Browser api accounts for that empty response.
- Fetch is asynchronous. loadingVersion stops an old filter response replacing a newer one. It does not cancel the network request or persist the selected filter across refresh.
- Browser title/description use textContent. A task title containing markup is displayed literally. A selected injection-like case passed; this is not universal security proof.
- Startup scenario picks a different source checkout in PowerShell. C++ --scenario is only metadata. CSS/SQL defects are actual changed source, not a hidden runtime fix switch.
- Build metadata contains commit, selected-file digest and UTC time. Health says what binary/build is serving; no model judgment can substitute for independent output/geometry checks.
- Build/static is regenerated output. Edit source static files and rebuild. Hand-editing a generated snapshot undermines its metadata correspondence.
- The existing repository is single-process/mutex-based, with SQLite lock timeout for file-level contention. No multi-user revision conflict handling, worker lease, vote, approval, model integration or execution sandbox exists.

## 7. Imported dependencies and binary artifacts

| Item | Role and actual usage |
| --- | --- |
| third_party/httplib.h (0.60.1) | HTTP server/router, Request/Response, query/regex match parsing, static mounting, timeouts and ThreadPool. Included by routes.hpp; main creates Server and routes.cpp registers handlers. Local Phase 1 server uses HTTP, not a verified cloud TLS client. |
| third_party/json.hpp (3.12.0) | nlohmann::json::parse, type/field inspection, array/object construction and dump serialization. Used in routes.cpp. |
| *.LICENSE | License terms/provenance of downloaded headers, not runtime control logic. |
| MSYS2 SQLite header/library and libsqlite3-0.dll | SQLite C API plus installed dynamic runtime, observed 3.53.4. Database connection/statements/parameters/transactions are wrapped in our C++ code. |
| libwinpthread-1.dll | Thread-support runtime matching the chosen Windows toolchain. |
| tools/node_modules/playwright and playwright-core | Driver/client implementations used by phase1.mjs for real browser actions/screenshots. Imported code is installed, not edited. |
| team-tasks.exe | Compiled binary; generated, about 17MB in this debug build. Its bytes are not editable C++ source. |
| *.db, *.db-wal, *.db-shm | SQLite data and possible WAL/shared-memory sidecars; no app source code. Keep them separate from Git source rollback. |
| *.png and report.json | Observation artifacts and assertion records, not patches. latest.json points to the latest report; earlier run directories are retained. |
| .git and fixture .git pointer files | Git bookkeeping, not application logic. Never repair a behavior by editing these internals. |

Reading vendor internals is a separate library-study exercise. Start with the exact APIs above, not all imported lines. We have no CMake, React, Python backend, employee workbench or worker modules in this phase.

## 8. Line-by-line source reference

The following tables are generated from actual UTF-8 source, with a checked explanation for every line. Blank lines and closing braces are explicitly accounted for. Common fixture files reuse these explanations; variant lines have their own section afterward.


### playground/src/task_repository.hpp

[Open actual file](/C:/AI_employee/playground/src/task_repository.hpp) · 29 lines · snapshot SHA256: dadf47d0d1bfb23e8f89eff226963bac0625d4514d95d57cc2473659210787e0

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/src/task_repository.hpp:1) | <code>#pragma once</code> | Header inclusion guard. |
| [2](/C:/AI_employee/playground/src/task_repository.hpp:2) | <code>#include &lt;mutex&gt;</code> | Provide mutex and lock_guard for repository synchronization. |
| [3](/C:/AI_employee/playground/src/task_repository.hpp:3) | <code>#include &lt;optional&gt;</code> | Provide optional for an update that may not find a task. |
| [4](/C:/AI_employee/playground/src/task_repository.hpp:4) | <code>#include &lt;string&gt;</code> | Provide string for task text and paths. |
| [5](/C:/AI_employee/playground/src/task_repository.hpp:5) | <code>#include &lt;vector&gt;</code> | Provide vector for a collection of returned tasks. |
| [6](/C:/AI_employee/playground/src/task_repository.hpp:6) | <code>#include &lt;sqlite3.h&gt;</code> | Import SQLite's C API declarations; linking the SQLite library supplies implementations. |
| [7](/C:/AI_employee/playground/src/task_repository.hpp:7) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [8](/C:/AI_employee/playground/src/task_repository.hpp:8) | <code>struct Task {</code> | Declare the Task data-transfer struct; its fields are public. |
| [9](/C:/AI_employee/playground/src/task_repository.hpp:9) | <code>    long long id;</code> | Use a signed 64-bit-compatible integer for the database task identifier. |
| [10](/C:/AI_employee/playground/src/task_repository.hpp:10) | <code>    std::string title, description, status, created_at;</code> | Store title, description, status and UTC timestamp as independent strings. |
| [11](/C:/AI_employee/playground/src/task_repository.hpp:11) | <code>};</code> | Close Task's declaration; class/struct declarations need a semicolon. |
| [12](/C:/AI_employee/playground/src/task_repository.hpp:12) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [13](/C:/AI_employee/playground/src/task_repository.hpp:13) | <code>class TaskRepository {</code> | Declare the repository abstraction that owns persistence and synchronization. |
| [14](/C:/AI_employee/playground/src/task_repository.hpp:14) | <code>public:</code> | Start the public interface. |
| [15](/C:/AI_employee/playground/src/task_repository.hpp:15) | <code>    explicit TaskRepository(const std::string&amp; path);</code> | Explicit constructor opens a specified database. explicit prevents an accidental implicit conversion from string to repository. |
| [16](/C:/AI_employee/playground/src/task_repository.hpp:16) | <code>    ~TaskRepository();</code> | Destructor closes the owned database connection. |
| [17](/C:/AI_employee/playground/src/task_repository.hpp:17) | <code>    TaskRepository(const TaskRepository&amp;) = delete;</code> | Delete copying so two objects cannot accidentally own and close the same database pointer. |
| [18](/C:/AI_employee/playground/src/task_repository.hpp:18) | <code>    TaskRepository&amp; operator=(const TaskRepository&amp;) = delete;</code> | Delete copy assignment for the same ownership reason. This class is not intended to be passed around by value. |
| [19](/C:/AI_employee/playground/src/task_repository.hpp:19) | <code>    std::vector&lt;Task&gt; list_tasks(const std::string&amp; status);</code> | Declare list_tasks: empty filter means all rows; a supplied supported status filters rows. |
| [20](/C:/AI_employee/playground/src/task_repository.hpp:20) | <code>    Task create_task(const std::string&amp; title, const std::string&amp; description, const std::string&amp; status);</code> | Declare create_task: accept validated values and return the stored row including its ID/timestamp. |
| [21](/C:/AI_employee/playground/src/task_repository.hpp:21) | <code>    std::optional&lt;Task&gt; update_task(long long id, const std::string&amp; status);</code> | Declare update_task: return a Task when found, or nullopt when the ID does not exist. |
| [22](/C:/AI_employee/playground/src/task_repository.hpp:22) | <code>    bool delete_task(long long id);</code> | Declare delete_task: true means one task was removed; false means none matched. |
| [23](/C:/AI_employee/playground/src/task_repository.hpp:23) | <code>    void reset_seed(); // Developer CLI only; never an HTTP route.</code> | Declare reset_seed for developer CLI use. No HTTP endpoint invokes it. |
| [24](/C:/AI_employee/playground/src/task_repository.hpp:24) | <code>private:</code> | Start internal members/helpers inaccessible to callers. |
| [25](/C:/AI_employee/playground/src/task_repository.hpp:25) | <code>    sqlite3* db_ = nullptr;</code> | Initialize the owned SQLite connection pointer to null so failed construction/cleanup can reason about it. |
| [26](/C:/AI_employee/playground/src/task_repository.hpp:26) | <code>    std::mutex mutex_;</code> | Own a mutex that serializes complete repository operations, not just individual SQLite calls. |
| [27](/C:/AI_employee/playground/src/task_repository.hpp:27) | <code>    void execute(const char* sql);</code> | Declare a helper for trusted constant SQL such as schema setup and seed transactions. |
| [28](/C:/AI_employee/playground/src/task_repository.hpp:28) | <code>    Task get_task(long long id);</code> | Declare a private row read helper. It relies on its create/update caller already holding the mutex; adding a second lock here would deadlock the non-recursive mutex. |
| [29](/C:/AI_employee/playground/src/task_repository.hpp:29) | <code>};</code> | Close the repository class declaration. |

### playground/src/task_repository.cpp

[Open actual file](/C:/AI_employee/playground/src/task_repository.cpp) · 101 lines · snapshot SHA256: 3caa306e050c2c584f640683815af3783c8957fa3c4a523d68180aeae3a3c4f6

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/src/task_repository.cpp:1) | <code>#include "task_repository.hpp"</code> | Include the matching repository declaration and SQLite types. |
| [2](/C:/AI_employee/playground/src/task_repository.cpp:2) | <code>#include &lt;stdexcept&gt;</code> | Provide runtime_error for database failures. |
| [3](/C:/AI_employee/playground/src/task_repository.cpp:3) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [4](/C:/AI_employee/playground/src/task_repository.cpp:4) | <code>namespace {</code> | Begin an unnamed namespace: helper names stay internal to this translation unit. |
| [5](/C:/AI_employee/playground/src/task_repository.cpp:5) | <code>class Statement {</code> | Declare Statement, a small RAII wrapper for one prepared SQL statement. |
| [6](/C:/AI_employee/playground/src/task_repository.cpp:6) | <code>public:</code> | Start its public methods. |
| [7](/C:/AI_employee/playground/src/task_repository.cpp:7) | <code>    Statement(sqlite3* db, const char* sql) : db_(db) {</code> | Constructor stores the connection pointer; it borrows the connection rather than owning/closing it. db_ is currently stored but otherwise unused. |
| [8](/C:/AI_employee/playground/src/task_repository.cpp:8) | <code>        if (sqlite3_prepare_v2(db, sql, -1, &amp;stmt_, nullptr) != SQLITE_OK)</code> | Prepare SQL, letting -1 indicate null-terminated SQL and asking SQLite to return a statement handle in stmt_. The unused SQL-tail output is null. |
| [9](/C:/AI_employee/playground/src/task_repository.cpp:9) | <code>            throw std::runtime_error("Database statement preparation failed");</code> | Throw if preparation failed; callers handle the exception at their boundary. |
| [10](/C:/AI_employee/playground/src/task_repository.cpp:10) | <code>    }</code> | Close the constructor. |
| [11](/C:/AI_employee/playground/src/task_repository.cpp:11) | <code>    ~Statement() { sqlite3_finalize(stmt_); }</code> | Finalize the statement when Statement leaves scope, including exception unwinding. This releases SQLite statement resources. |
| [12](/C:/AI_employee/playground/src/task_repository.cpp:12) | <code>    Statement(const Statement&amp;) = delete;</code> | Disable copying to prevent double finalization of a shared statement handle. |
| [13](/C:/AI_employee/playground/src/task_repository.cpp:13) | <code>    Statement&amp; operator=(const Statement&amp;) = delete;</code> | Disable copy assignment for the same reason. |
| [14](/C:/AI_employee/playground/src/task_repository.cpp:14) | <code>    void text(int position, const std::string&amp; value) {</code> | Declare text parameter binding using SQLite's 1-based parameter positions. |
| [15](/C:/AI_employee/playground/src/task_repository.cpp:15) | <code>        if (sqlite3_bind_text(stmt_, position, value.c_str(), static_cast&lt;int&gt;(value.size()), SQLITE_TRANSIENT) != SQLITE_OK)</code> | Bind a string as data, not SQL syntax. c_str supplies bytes, size gives the exact length, and SQLITE_TRANSIENT tells SQLite to copy them before the binding call returns. |
| [16](/C:/AI_employee/playground/src/task_repository.cpp:16) | <code>            throw std::runtime_error("Database parameter binding failed");</code> | Throw if binding failed. |
| [17](/C:/AI_employee/playground/src/task_repository.cpp:17) | <code>    }</code> | Close text binding. |
| [18](/C:/AI_employee/playground/src/task_repository.cpp:18) | <code>    void integer(int position, long long value) {</code> | Declare integer parameter binding. |
| [19](/C:/AI_employee/playground/src/task_repository.cpp:19) | <code>        if (sqlite3_bind_int64(stmt_, position, value) != SQLITE_OK)</code> | Bind a 64-bit integer at the supplied 1-based position. |
| [20](/C:/AI_employee/playground/src/task_repository.cpp:20) | <code>            throw std::runtime_error("Database parameter binding failed");</code> | Throw if integer binding failed. |
| [21](/C:/AI_employee/playground/src/task_repository.cpp:21) | <code>    }</code> | Close integer binding. |
| [22](/C:/AI_employee/playground/src/task_repository.cpp:22) | <code>    int step() {</code> | Declare a checked statement execution/iteration step. |
| [23](/C:/AI_employee/playground/src/task_repository.cpp:23) | <code>        int result = sqlite3_step(stmt_);</code> | Advance the statement using sqlite3_step. SELECT may produce one row per call; INSERT/UPDATE/DELETE normally finish with DONE. |
| [24](/C:/AI_employee/playground/src/task_repository.cpp:24) | <code>        if (result != SQLITE_ROW &amp;&amp; result != SQLITE_DONE)</code> | Accept only ROW and DONE; other results represent failure for these operations. |
| [25](/C:/AI_employee/playground/src/task_repository.cpp:25) | <code>            throw std::runtime_error("Database operation failed");</code> | Throw a generic database operation error for those other results. |
| [26](/C:/AI_employee/playground/src/task_repository.cpp:26) | <code>        return result;</code> | Return ROW or DONE to the caller. |
| [27](/C:/AI_employee/playground/src/task_repository.cpp:27) | <code>    }</code> | Close step. |
| [28](/C:/AI_employee/playground/src/task_repository.cpp:28) | <code>    Task row() const {</code> | Declare conversion of the current SELECT row to the application's Task struct. const prevents changing Statement members through this method. |
| [29](/C:/AI_employee/playground/src/task_repository.cpp:29) | <code>        auto text_at = [this](int column) {</code> | Create a lambda capturing this to read a text column from the current statement. |
| [30](/C:/AI_employee/playground/src/task_repository.cpp:30) | <code>            const auto* value = sqlite3_column_text(stmt_, column);</code> | Get SQLite's text bytes for the selected 0-based column. |
| [31](/C:/AI_employee/playground/src/task_repository.cpp:31) | <code>            return value ? std::string(reinterpret_cast&lt;const char*&gt;(value)) : std::string{};</code> | Copy the bytes into an owning std::string, or return an empty string for a null pointer. Copying prevents dependence on SQLite's row-buffer lifetime. |
| [32](/C:/AI_employee/playground/src/task_repository.cpp:32) | <code>        };</code> | Close the text_at lambda. |
| [33](/C:/AI_employee/playground/src/task_repository.cpp:33) | <code>        return {sqlite3_column_int64(stmt_, 0), text_at(1), text_at(2), text_at(3), text_at(4)};</code> | Read ID at column 0 and the four strings at columns 1 through 4; return a Task aggregate. This ordering must match each SELECT column list. |
| [34](/C:/AI_employee/playground/src/task_repository.cpp:34) | <code>    }</code> | Close row conversion. |
| [35](/C:/AI_employee/playground/src/task_repository.cpp:35) | <code>private:</code> | Start private Statement members. |
| [36](/C:/AI_employee/playground/src/task_repository.cpp:36) | <code>    sqlite3* db_;</code> | Borrowed connection pointer; this wrapper does not close it and currently does not use the stored member beyond construction. |
| [37](/C:/AI_employee/playground/src/task_repository.cpp:37) | <code>    sqlite3_stmt* stmt_ = nullptr;</code> | Initialize the owned statement pointer to null. |
| [38](/C:/AI_employee/playground/src/task_repository.cpp:38) | <code>};</code> | Close Statement. |
| [39](/C:/AI_employee/playground/src/task_repository.cpp:39) | <code>}</code> | Close the unnamed namespace. |
| [40](/C:/AI_employee/playground/src/task_repository.cpp:40) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [41](/C:/AI_employee/playground/src/task_repository.cpp:41) | <code>TaskRepository::TaskRepository(const std::string&amp; path) {</code> | Define repository construction using the selected file path. |
| [42](/C:/AI_employee/playground/src/task_repository.cpp:42) | <code>    if (sqlite3_open_v2(path.c_str(), &amp;db_, SQLITE_OPEN_READWRITE &#124; SQLITE_OPEN_CREATE &#124; SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK) {</code> | Open with read/write, create-if-missing and FULLMUTEX connection flags. This still needs the application mutex for multi-call operations such as INSERT followed by last_insert_rowid. |
| [43](/C:/AI_employee/playground/src/task_repository.cpp:43) | <code>        if (db_) sqlite3_close(db_);</code> | If opening failed but supplied a handle, close it. |
| [44](/C:/AI_employee/playground/src/task_repository.cpp:44) | <code>        db_ = nullptr;</code> | Clear the pointer after cleanup. |
| [45](/C:/AI_employee/playground/src/task_repository.cpp:45) | <code>        throw std::runtime_error("Could not open task database");</code> | Throw a generic file/database startup error. |
| [46](/C:/AI_employee/playground/src/task_repository.cpp:46) | <code>    }</code> | Close the failed-open branch. |
| [47](/C:/AI_employee/playground/src/task_repository.cpp:47) | <code>    try {</code> | Begin schema/setup operations whose failures require explicit constructor cleanup (a failed object's destructor will not run). |
| [48](/C:/AI_employee/playground/src/task_repository.cpp:48) | <code>        sqlite3_busy_timeout(db_, 3000);</code> | Let SQLite wait up to 3000 milliseconds for certain lock-contention conditions before returning failure; this is not a worker retry policy. |
| [49](/C:/AI_employee/playground/src/task_repository.cpp:49) | <code>        execute("PRAGMA journal_mode=WAL;");</code> | Enable write-ahead logging. SQLite may maintain .db-wal and .db-shm sidecar files alongside the database. |
| [50](/C:/AI_employee/playground/src/task_repository.cpp:50) | <code>        execute("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));");</code> | Create tasks only if absent. id is an autoincrement integer primary key; title is non-null and 1–120 SQL characters; description defaults empty; status has an enum CHECK; created_at defaults to UTC ISO-like text. Route title length is separately measured in bytes. |
| [51](/C:/AI_employee/playground/src/task_repository.cpp:51) | <code>    } catch (...) { sqlite3_close(db_); db_ = nullptr; throw; }</code> | On any setup exception, close the connection, clear the pointer and rethrow the original exception. |
| [52](/C:/AI_employee/playground/src/task_repository.cpp:52) | <code>}</code> | Close the constructor. |
| [53](/C:/AI_employee/playground/src/task_repository.cpp:53) | <code>TaskRepository::~TaskRepository() { if (db_) sqlite3_close(db_); }</code> | Close the database when the repository is destroyed, if it has a connection. |
| [54](/C:/AI_employee/playground/src/task_repository.cpp:54) | <code>void TaskRepository::execute(const char* sql) {</code> | Define execution of trusted constant SQL, used for schema and transactional seed setup. |
| [55](/C:/AI_employee/playground/src/task_repository.cpp:55) | <code>    if (sqlite3_exec(db_, sql, nullptr, nullptr, nullptr) != SQLITE_OK)</code> | Execute SQL without row callbacks or error-message allocation. Submitted task text never reaches this helper as SQL. |
| [56](/C:/AI_employee/playground/src/task_repository.cpp:56) | <code>        throw std::runtime_error("Database transaction failed");</code> | Throw if execution failed. This generic error wording is also used for schema/pragma failures. |
| [57](/C:/AI_employee/playground/src/task_repository.cpp:57) | <code>}</code> | Close execute. |
| [58](/C:/AI_employee/playground/src/task_repository.cpp:58) | <code>std::vector&lt;Task&gt; TaskRepository::list_tasks(const std::string&amp; status) {</code> | Define filtered task retrieval; a const string reference avoids copying the filter. |
| [59](/C:/AI_employee/playground/src/task_repository.cpp:59) | <code>    std::lock_guard lock(mutex_);</code> | Acquire the mutex for the whole SELECT/iteration operation. lock_guard releases it automatically on return or exception. |
| [60](/C:/AI_employee/playground/src/task_repository.cpp:60) | <code>    const char* sql = "SELECT id,title,description,status,created_at FROM tasks WHERE (?1 = '' OR status = ?1) ORDER BY id;";</code> | Clean query: return a row if parameter ?1 is empty (no filter), or if this row's status equals that parameter; sort by ID. ?1 is a bound request value; status is a per-row database column. |
| [61](/C:/AI_employee/playground/src/task_repository.cpp:61) | <code>    Statement query(db_, sql);</code> | Prepare the SELECT query in an RAII Statement. |
| [62](/C:/AI_employee/playground/src/task_repository.cpp:62) | <code>    query.text(1, status);</code> | Bind the requested status to parameter 1. All occurrences of ?1 use that same value. |
| [63](/C:/AI_employee/playground/src/task_repository.cpp:63) | <code>    std::vector&lt;Task&gt; tasks;</code> | Create an initially empty result vector. |
| [64](/C:/AI_employee/playground/src/task_repository.cpp:64) | <code>    while (query.step() == SQLITE_ROW) tasks.push_back(query.row());</code> | Repeatedly step until DONE; for every ROW, copy a Task into the vector. |
| [65](/C:/AI_employee/playground/src/task_repository.cpp:65) | <code>    return tasks;</code> | Return the collected tasks. Query finalization and mutex unlocking occur on scope exit. |
| [66](/C:/AI_employee/playground/src/task_repository.cpp:66) | <code>}</code> | Close list_tasks. |
| [67](/C:/AI_employee/playground/src/task_repository.cpp:67) | <code>Task TaskRepository::get_task(long long id) {</code> | Define internal retrieval of exactly one task after a successful write. Callers already hold the mutex. |
| [68](/C:/AI_employee/playground/src/task_repository.cpp:68) | <code>    Statement query(db_, "SELECT id,title,description,status,created_at FROM tasks WHERE id=?1;");</code> | Prepare a SELECT whose ID is a parameter. |
| [69](/C:/AI_employee/playground/src/task_repository.cpp:69) | <code>    query.integer(1, id);</code> | Bind the supplied task ID. |
| [70](/C:/AI_employee/playground/src/task_repository.cpp:70) | <code>    if (query.step() != SQLITE_ROW) throw std::runtime_error("Task read after write failed");</code> | Require a row; a missing row after a reported write is an internal storage failure, not an ordinary caller 404. |
| [71](/C:/AI_employee/playground/src/task_repository.cpp:71) | <code>    return query.row();</code> | Return a copied Task from that row. |
| [72](/C:/AI_employee/playground/src/task_repository.cpp:72) | <code>}</code> | Close get_task. |
| [73](/C:/AI_employee/playground/src/task_repository.cpp:73) | <code>Task TaskRepository::create_task(const std::string&amp; title, const std::string&amp; description, const std::string&amp; status) {</code> | Define creation of a task with validated title, description and status. |
| [74](/C:/AI_employee/playground/src/task_repository.cpp:74) | <code>    std::lock_guard lock(mutex_);</code> | Hold the mutex across both INSERT and retrieval of its newly allocated ID/row. |
| [75](/C:/AI_employee/playground/src/task_repository.cpp:75) | <code>    Statement query(db_, "INSERT INTO tasks(title,description,status) VALUES(?1,?2,?3);");</code> | Prepare an INSERT with three independent bound values; ID and timestamp use database defaults. |
| [76](/C:/AI_employee/playground/src/task_repository.cpp:76) | <code>    query.text(1, title); query.text(2, description); query.text(3, status);</code> | Bind title at 1, description at 2 and status at 3. |
| [77](/C:/AI_employee/playground/src/task_repository.cpp:77) | <code>    query.step();</code> | Execute the INSERT; failure throws. A successful standalone INSERT uses SQLite's implicit transaction/autocommit. |
| [78](/C:/AI_employee/playground/src/task_repository.cpp:78) | <code>    return get_task(sqlite3_last_insert_rowid(db_));</code> | Get the inserted row's ID from this connection and retrieve its full Task while still holding the mutex. |
| [79](/C:/AI_employee/playground/src/task_repository.cpp:79) | <code>}</code> | Close create_task. |
| [80](/C:/AI_employee/playground/src/task_repository.cpp:80) | <code>std::optional&lt;Task&gt; TaskRepository::update_task(long long id, const std::string&amp; status) {</code> | Define status-only task update; optional represents an ordinary missing ID. |
| [81](/C:/AI_employee/playground/src/task_repository.cpp:81) | <code>    std::lock_guard lock(mutex_);</code> | Lock the connection for the update and subsequent read. |
| [82](/C:/AI_employee/playground/src/task_repository.cpp:82) | <code>    Statement query(db_, "UPDATE tasks SET status=?1 WHERE id=?2;");</code> | Prepare an UPDATE of status for a parameterized ID. |
| [83](/C:/AI_employee/playground/src/task_repository.cpp:83) | <code>    query.text(1, status); query.integer(2, id); query.step();</code> | Bind status and ID, then execute the update. |
| [84](/C:/AI_employee/playground/src/task_repository.cpp:84) | <code>    if (!sqlite3_changes(db_)) return std::nullopt;</code> | If no row matched the update, return nullopt; the route converts it into 404. |
| [85](/C:/AI_employee/playground/src/task_repository.cpp:85) | <code>    return get_task(id);</code> | Read and return the updated task while the mutex remains held. |
| [86](/C:/AI_employee/playground/src/task_repository.cpp:86) | <code>}</code> | Close update_task. |
| [87](/C:/AI_employee/playground/src/task_repository.cpp:87) | <code>bool TaskRepository::delete_task(long long id) {</code> | Define task deletion. |
| [88](/C:/AI_employee/playground/src/task_repository.cpp:88) | <code>    std::lock_guard lock(mutex_);</code> | Lock the connection for this complete operation. |
| [89](/C:/AI_employee/playground/src/task_repository.cpp:89) | <code>    Statement query(db_, "DELETE FROM tasks WHERE id=?1;");</code> | Prepare DELETE with a parameterized ID. |
| [90](/C:/AI_employee/playground/src/task_repository.cpp:90) | <code>    query.integer(1, id); query.step();</code> | Bind ID and execute DELETE. |
| [91](/C:/AI_employee/playground/src/task_repository.cpp:91) | <code>    return sqlite3_changes(db_) == 1;</code> | Report whether exactly one row was affected. The primary key makes at most one row match. |
| [92](/C:/AI_employee/playground/src/task_repository.cpp:92) | <code>}</code> | Close delete_task. |
| [93](/C:/AI_employee/playground/src/task_repository.cpp:93) | <code>void TaskRepository::reset_seed() {</code> | Define developer seed/reset on this database only. |
| [94](/C:/AI_employee/playground/src/task_repository.cpp:94) | <code>    std::lock_guard lock(mutex_);</code> | Hold the connection mutex for the entire multi-statement reset. |
| [95](/C:/AI_employee/playground/src/task_repository.cpp:95) | <code>    execute("BEGIN IMMEDIATE;");</code> | Begin an explicit immediate write transaction, obtaining the write reservation early. |
| [96](/C:/AI_employee/playground/src/task_repository.cpp:96) | <code>    try {</code> | Catch reset failures so partial reset cannot be committed. |
| [97](/C:/AI_employee/playground/src/task_repository.cpp:97) | <code>        execute("DELETE FROM tasks; DELETE FROM sqlite_sequence WHERE name='tasks';");</code> | Delete task rows and reset this table's autoincrement sequence. This is destructive to synthetic task data, not a source-code repair. |
| [98](/C:/AI_employee/playground/src/task_repository.cpp:98) | <code>        execute("INSERT INTO tasks(id,title,description,status) VALUES (1,'Plan the team kickoff','Draft a short agenda for our fictional team.','todo'), (2,'Review the design notes','Check the task card layouts and interactions.','todo'), (3,'Build the task board','Connect the interface to persistent task data.','in_progress'), (4,'Prepare the demo checklist','Keep all demonstration data synthetic.','done');");</code> | Insert fixed IDs 1/2 as todo, 3 as in_progress and 4 as done, with fictional titles/descriptions. Timestamp defaults are generated when seeding. |
| [99](/C:/AI_employee/playground/src/task_repository.cpp:99) | <code>        execute("COMMIT;");</code> | Commit all reset changes together. |
| [100](/C:/AI_employee/playground/src/task_repository.cpp:100) | <code>    } catch (...) { execute("ROLLBACK;"); throw; }</code> | On failure attempt ROLLBACK and rethrow. A rollback failure could replace the original exception; the current implementation has no separate rollback-error recording. |
| [101](/C:/AI_employee/playground/src/task_repository.cpp:101) | <code>}</code> | Close reset_seed. |

### playground/src/routes.hpp

[Open actual file](/C:/AI_employee/playground/src/routes.hpp) · 4 lines · snapshot SHA256: 7b7c803d600b136f17e00c3236d69a2e8c2c16ed2078a2231e8b9f0aa95e90f3

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/src/routes.hpp:1) | <code>#pragma once</code> | Prevent this header from being included more than once within a translation unit. |
| [2](/C:/AI_employee/playground/src/routes.hpp:2) | <code>#include "httplib.h"</code> | Make cpp-httplib Server/Request/Response types available. |
| [3](/C:/AI_employee/playground/src/routes.hpp:3) | <code>#include "task_repository.hpp"</code> | Make Task and TaskRepository declarations available. |
| [4](/C:/AI_employee/playground/src/routes.hpp:4) | <code>void register_routes(httplib::Server&amp; server, TaskRepository&amp; repository, int port, const std::string&amp; scenario);</code> | Declare register_routes. Server and repository are references to existing objects; port and scenario configure guards and metadata. The implementation lives in routes.cpp. |

### playground/src/routes.cpp

[Open actual file](/C:/AI_employee/playground/src/routes.cpp) · 131 lines · snapshot SHA256: e9068896e5b0d0849d906d1f7dfc0ffdbb5c188e72760acada1e0b706c0ad2a9

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/src/routes.cpp:1) | <code>#include "routes.hpp"</code> | Include the route declaration and repository/HTTP types. |
| [2](/C:/AI_employee/playground/src/routes.cpp:2) | <code>#include "json.hpp"</code> | Include the vendored JSON parser/serializer. |
| [3](/C:/AI_employee/playground/src/routes.cpp:3) | <code>#include &lt;algorithm&gt;</code> | Provide std::find for allowed-field validation. |
| [4](/C:/AI_employee/playground/src/routes.cpp:4) | <code>#include &lt;charconv&gt;</code> | Provide from_chars for checked integer ID parsing. |
| [5](/C:/AI_employee/playground/src/routes.cpp:5) | <code>#include &lt;iostream&gt;</code> | Provide stderr logging. |
| [6](/C:/AI_employee/playground/src/routes.cpp:6) | <code>#include &lt;stdexcept&gt;</code> | Provide exception types. |
| [7](/C:/AI_employee/playground/src/routes.cpp:7) | <code>#include "build_identity.hpp"</code> | Include the generated build identity header from build/. Compilation must use the provided build script to create/find it. |
| [8](/C:/AI_employee/playground/src/routes.cpp:8) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [9](/C:/AI_employee/playground/src/routes.cpp:9) | <code>#ifndef PLAYGROUND_COMMIT</code> | Begin a fallback only if the commit macro is undefined after that header was included. |
| [10](/C:/AI_employee/playground/src/routes.cpp:10) | <code>#define PLAYGROUND_COMMIT "unversioned"</code> | Use unversioned if a supplied generated header omitted the commit definition. This does not make a missing header acceptable. |
| [11](/C:/AI_employee/playground/src/routes.cpp:11) | <code>#endif</code> | End the commit fallback condition. |
| [12](/C:/AI_employee/playground/src/routes.cpp:12) | <code>#ifndef PLAYGROUND_BUILD</code> | Begin equivalent fallback for the build digest. |
| [13](/C:/AI_employee/playground/src/routes.cpp:13) | <code>#define PLAYGROUND_BUILD "unknown"</code> | Use unknown if the build macro was not defined. |
| [14](/C:/AI_employee/playground/src/routes.cpp:14) | <code>#endif</code> | End the build fallback condition. |
| [15](/C:/AI_employee/playground/src/routes.cpp:15) | <code>using json = nlohmann::json;</code> | Give nlohmann::json the shorter local type alias json. |
| [16](/C:/AI_employee/playground/src/routes.cpp:16) | <code>namespace {</code> | Keep helper function names internal to the translation unit. |
| [17](/C:/AI_employee/playground/src/routes.cpp:17) | <code>json task_json(const Task&amp; task) {</code> | Declare Task-to-JSON conversion. |
| [18](/C:/AI_employee/playground/src/routes.cpp:18) | <code>    return {{"id",task.id},{"title",task.title},{"description",task.description},{"status",task.status},{"created_at",task.created_at}};</code> | Return a JSON object with ID, title, description, status and timestamp copied from the Task. |
| [19](/C:/AI_employee/playground/src/routes.cpp:19) | <code>}</code> | Close task_json. |
| [20](/C:/AI_employee/playground/src/routes.cpp:20) | <code>void respond(httplib::Response&amp; response, int status, const json&amp; body) {</code> | Declare a standard JSON HTTP response helper. |
| [21](/C:/AI_employee/playground/src/routes.cpp:21) | <code>    response.status = status;</code> | Set the HTTP status code. |
| [22](/C:/AI_employee/playground/src/routes.cpp:22) | <code>    response.set_content(body.dump(), "application/json; charset=utf-8");</code> | Serialize the JSON object with dump and set application/json UTF-8 content type. |
| [23](/C:/AI_employee/playground/src/routes.cpp:23) | <code>}</code> | Close respond. |
| [24](/C:/AI_employee/playground/src/routes.cpp:24) | <code>bool valid_status(const std::string&amp; value) { return value == "todo" &#124;&#124; value == "in_progress" &#124;&#124; value == "done"; }</code> | Accept exactly the three supported enum strings: todo, in_progress and done. |
| [25](/C:/AI_employee/playground/src/routes.cpp:25) | <code>json parse_body(const httplib::Request&amp; request, const std::vector&lt;std::string&gt;&amp; allowed) {</code> | Declare parsing/shape validation of a write request against an allowed key list. |
| [26](/C:/AI_employee/playground/src/routes.cpp:26) | <code>    if (request.get_header_value("Content-Type").find("application/json") != 0)</code> | Check whether Content-Type starts with application/json. This is a prefix check, not a complete MIME parser. |
| [27](/C:/AI_employee/playground/src/routes.cpp:27) | <code>        throw std::invalid_argument("Use application/json");</code> | Reject requests that fail that check. |
| [28](/C:/AI_employee/playground/src/routes.cpp:28) | <code>    json body;</code> | Create storage for parsed JSON. |
| [29](/C:/AI_employee/playground/src/routes.cpp:29) | <code>    try { body = json::parse(request.body); }</code> | Parse the raw request body as JSON. |
| [30](/C:/AI_employee/playground/src/routes.cpp:30) | <code>    catch (const json::exception&amp;) { throw std::invalid_argument("Malformed JSON"); }</code> | Translate JSON parser exceptions into the route's ordinary invalid_argument error type. |
| [31](/C:/AI_employee/playground/src/routes.cpp:31) | <code>    if (!body.is_object()) throw std::invalid_argument("Expected a JSON object");</code> | Require an object rather than an array, number, null or string. |
| [32](/C:/AI_employee/playground/src/routes.cpp:32) | <code>    for (const auto&amp; [key, value] : body.items()) {</code> | Iterate over every submitted object key/value with structured bindings. |
| [33](/C:/AI_employee/playground/src/routes.cpp:33) | <code>        if (std::find(allowed.begin(), allowed.end(), key) == allowed.end())</code> | Search for the key in this route's allowed field names. |
| [34](/C:/AI_employee/playground/src/routes.cpp:34) | <code>            throw std::invalid_argument("Unexpected field: " + key);</code> | Reject unknown fields rather than silently accepting them. |
| [35](/C:/AI_employee/playground/src/routes.cpp:35) | <code>        if (!value.is_string()) throw std::invalid_argument("Fields must be strings");</code> | Require all supplied field values to be strings. Required presence/length checks follow separately in field. |
| [36](/C:/AI_employee/playground/src/routes.cpp:36) | <code>    }</code> | Close object-field iteration. |
| [37](/C:/AI_employee/playground/src/routes.cpp:37) | <code>    return body;</code> | Return the validated object shape. Default JSON parsing does not explicitly reject duplicate object keys here. |
| [38](/C:/AI_employee/playground/src/routes.cpp:38) | <code>}</code> | Close parse_body. |
| [39](/C:/AI_employee/playground/src/routes.cpp:39) | <code>std::string field(const json&amp; body, const std::string&amp; key, std::size_t maximum, bool required = true) {</code> | Declare string extraction with a maximum byte count and optional required-presence/blank checks; required defaults to true. |
| [40](/C:/AI_employee/playground/src/routes.cpp:40) | <code>    if (!body.contains(key)) {</code> | Check whether the key is absent. |
| [41](/C:/AI_employee/playground/src/routes.cpp:41) | <code>        if (required) throw std::invalid_argument("Missing field: " + key);</code> | Throw for an absent required field. |
| [42](/C:/AI_employee/playground/src/routes.cpp:42) | <code>        return "";</code> | Return empty text for an absent optional field such as description. |
| [43](/C:/AI_employee/playground/src/routes.cpp:43) | <code>    }</code> | Close absent-field branch. |
| [44](/C:/AI_employee/playground/src/routes.cpp:44) | <code>    auto value = body.at(key).get&lt;std::string&gt;();</code> | Retrieve the string value; parse_body already ensured strings for these route callers. |
| [45](/C:/AI_employee/playground/src/routes.cpp:45) | <code>    if (value.size() &gt; maximum &#124;&#124; value.find('\0') != std::string::npos)</code> | Reject overlong byte strings or embedded NUL. std::string::size counts UTF-8 bytes here, while browser maxlength and SQL length count differently. |
| [46](/C:/AI_employee/playground/src/routes.cpp:46) | <code>        throw std::invalid_argument("Invalid length or embedded NUL: " + key);</code> | Throw the length/NUL validation error. |
| [47](/C:/AI_employee/playground/src/routes.cpp:47) | <code>    if (required &amp;&amp; value.find_first_not_of(" \t\r\n") == std::string::npos)</code> | For required fields, find any character outside the four listed ASCII whitespace characters. |
| [48](/C:/AI_employee/playground/src/routes.cpp:48) | <code>        throw std::invalid_argument("Field cannot be blank: " + key);</code> | Reject empty/all-ASCII-whitespace required values. This does not implement all Unicode whitespace normalization. |
| [49](/C:/AI_employee/playground/src/routes.cpp:49) | <code>    return value;</code> | Return the original string; this helper does not trim it. The browser form trims its own submitted values. |
| [50](/C:/AI_employee/playground/src/routes.cpp:50) | <code>}</code> | Close field. |
| [51](/C:/AI_employee/playground/src/routes.cpp:51) | <code>long long task_id(const httplib::Request&amp; request) {</code> | Declare extraction of a task ID captured by the route regex. |
| [52](/C:/AI_employee/playground/src/routes.cpp:52) | <code>    auto value = request.matches[1].str();</code> | Read capture group 1 from the HTTP match. |
| [53](/C:/AI_employee/playground/src/routes.cpp:53) | <code>    long long id{};</code> | Zero-initialize a signed long long. |
| [54](/C:/AI_employee/playground/src/routes.cpp:54) | <code>    auto result = std::from_chars(value.data(), value.data()+value.size(), id);</code> | Parse the captured digits without exceptions and inspect the result's error code. The route regex permits digits only. |
| [55](/C:/AI_employee/playground/src/routes.cpp:55) | <code>    if (result.ec != std::errc{} &#124;&#124; id &lt;= 0) throw std::invalid_argument("Invalid task ID");</code> | Reject numeric overflow/conversion failure or nonpositive IDs. |
| [56](/C:/AI_employee/playground/src/routes.cpp:56) | <code>    return id;</code> | Return the parsed ID. |
| [57](/C:/AI_employee/playground/src/routes.cpp:57) | <code>}</code> | Close task_id. |
| [58](/C:/AI_employee/playground/src/routes.cpp:58) | <code>template&lt;class Action&gt;</code> | Declare a generic wrapper parameterized on a callable's type. |
| [59](/C:/AI_employee/playground/src/routes.cpp:59) | <code>auto safe(Action action) {</code> | Take that callable by value and let auto deduce the returned lambda type. |
| [60](/C:/AI_employee/playground/src/routes.cpp:60) | <code>    return [action](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Return a request handler capturing the callable by value so it remains alive after registration. |
| [61](/C:/AI_employee/playground/src/routes.cpp:61) | <code>        try { action(request, response); }</code> | Invoke the supplied handler under exception handling. |
| [62](/C:/AI_employee/playground/src/routes.cpp:62) | <code>        catch (const std::invalid_argument&amp; error) { respond(response, 400, {{"error",error.what()}}); }</code> | Return JSON HTTP 400 for input-validation exceptions, including the validation explanation. |
| [63](/C:/AI_employee/playground/src/routes.cpp:63) | <code>        catch (const std::exception&amp;) {</code> | Catch other standard exceptions as storage/internal failures. |
| [64](/C:/AI_employee/playground/src/routes.cpp:64) | <code>            std::cerr &lt;&lt; "Task operation failed; no request contents logged\n";</code> | Log a generic failure without dumping submitted text or database credentials. |
| [65](/C:/AI_employee/playground/src/routes.cpp:65) | <code>            respond(response, 500, {{"error","Task storage operation failed"}});</code> | Return a generic HTTP 500 storage error; do not expose exception internals to the browser. |
| [66](/C:/AI_employee/playground/src/routes.cpp:66) | <code>        }</code> | Close the general-exception branch. |
| [67](/C:/AI_employee/playground/src/routes.cpp:67) | <code>    };</code> | Close the returned lambda. |
| [68](/C:/AI_employee/playground/src/routes.cpp:68) | <code>}</code> | Close safe. |
| [69](/C:/AI_employee/playground/src/routes.cpp:69) | <code>}</code> | Close the unnamed namespace. |
| [70](/C:/AI_employee/playground/src/routes.cpp:70) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [71](/C:/AI_employee/playground/src/routes.cpp:71) | <code>void register_routes(httplib::Server&amp; server, TaskRepository&amp; repository, int port, const std::string&amp; scenario) {</code> | Define route registration using the live server/repository, port and display scenario. |
| [72](/C:/AI_employee/playground/src/routes.cpp:72) | <code>    server.set_pre_routing_handler([port](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Register a guard that runs before routing. Capture port by value so it survives register_routes returning. |
| [73](/C:/AI_employee/playground/src/routes.cpp:73) | <code>        const auto host = request.get_header_value("Host");</code> | Read the request Host header. |
| [74](/C:/AI_employee/playground/src/routes.cpp:74) | <code>        const auto suffix = ":" + std::to_string(port);</code> | Build the expected colon-port suffix. |
| [75](/C:/AI_employee/playground/src/routes.cpp:75) | <code>        if (host != "localhost" + suffix &amp;&amp; host != "127.0.0.1" + suffix) {</code> | Require localhost:port or 127.0.0.1:port. This guard complements loopback binding. |
| [76](/C:/AI_employee/playground/src/routes.cpp:76) | <code>            respond(response, 403, {{"error","Local host required"}});</code> | Return a JSON 403 for another Host value. |
| [77](/C:/AI_employee/playground/src/routes.cpp:77) | <code>            return httplib::Server::HandlerResponse::Handled;</code> | Mark the request handled so its normal route does not run. |
| [78](/C:/AI_employee/playground/src/routes.cpp:78) | <code>        }</code> | Close wrong-host branch. |
| [79](/C:/AI_employee/playground/src/routes.cpp:79) | <code>        if (request.method != "GET" &amp;&amp; request.method != "HEAD") {</code> | Apply additional checks to non-GET/non-HEAD requests, including writes. |
| [80](/C:/AI_employee/playground/src/routes.cpp:80) | <code>            const auto origin = request.get_header_value("Origin");</code> | Read Origin; non-browser CLI requests may have no Origin header. |
| [81](/C:/AI_employee/playground/src/routes.cpp:81) | <code>            if ((!origin.empty() &amp;&amp; origin != "http://localhost" + suffix &amp;&amp; origin != "http://127.0.0.1" + suffix)</code> | Reject a nonempty origin outside the two allowed local origin strings. |
| [82](/C:/AI_employee/playground/src/routes.cpp:82) | <code>                &#124;&#124; request.get_header_value("Sec-Fetch-Site") == "cross-site") {</code> | Also reject Sec-Fetch-Site declaring cross-site, even if Origin is absent. |
| [83](/C:/AI_employee/playground/src/routes.cpp:83) | <code>                respond(response, 403, {{"error","Cross-origin writes denied"}});</code> | Return JSON 403 for a forbidden cross-origin write. |
| [84](/C:/AI_employee/playground/src/routes.cpp:84) | <code>                return httplib::Server::HandlerResponse::Handled;</code> | Mark the rejected request handled. |
| [85](/C:/AI_employee/playground/src/routes.cpp:85) | <code>            }</code> | Close forbidden-origin branch. |
| [86](/C:/AI_employee/playground/src/routes.cpp:86) | <code>        }</code> | Close write-only guard branch. |
| [87](/C:/AI_employee/playground/src/routes.cpp:87) | <code>        return httplib::Server::HandlerResponse::Unhandled;</code> | Let ordinary routing continue when guards passed. |
| [88](/C:/AI_employee/playground/src/routes.cpp:88) | <code>    });</code> | Finish registration of the pre-routing lambda. |
| [89](/C:/AI_employee/playground/src/routes.cpp:89) | <code>    server.set_post_routing_handler([](const httplib::Request&amp;, httplib::Response&amp; response) {</code> | Register a post-routing response-header handler; request argument is intentionally unused. |
| [90](/C:/AI_employee/playground/src/routes.cpp:90) | <code>        response.set_header("Cache-Control","no-store");</code> | Ask clients/intermediaries not to store responses in cache. |
| [91](/C:/AI_employee/playground/src/routes.cpp:91) | <code>        response.set_header("X-Content-Type-Options","nosniff");</code> | Disable browser MIME sniffing through X-Content-Type-Options. |
| [92](/C:/AI_employee/playground/src/routes.cpp:92) | <code>        response.set_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");</code> | Apply CSP: resources/connections come from this origin, framing is denied and base URL overrides are denied. This is browser policy, not OS execution isolation or authentication. |
| [93](/C:/AI_employee/playground/src/routes.cpp:93) | <code>    });</code> | Finish header-handler registration. |
| [94](/C:/AI_employee/playground/src/routes.cpp:94) | <code>    server.Get("/api/health", [scenario](const httplib::Request&amp;, httplib::Response&amp; response) {</code> | Register the read-only health metadata endpoint; capture scenario by value. |
| [95](/C:/AI_employee/playground/src/routes.cpp:95) | <code>        respond(response, 200, {{"status","ok"},{"scenario",scenario},{"commit",PLAYGROUND_COMMIT},{"build",PLAYGROUND_BUILD},{"sqlite",sqlite3_libversion()}});</code> | Return 200 with status, label, compiled commit/build identity and linked SQLite runtime version. A health label does not select fixture behavior. |
| [96](/C:/AI_employee/playground/src/routes.cpp:96) | <code>    });</code> | Finish health route registration. |
| [97](/C:/AI_employee/playground/src/routes.cpp:97) | <code>    server.Get("/api/tasks", safe([&amp;repository](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Register GET /api/tasks with the exception-handling wrapper. Repository is borrowed by reference and main keeps it alive while serving. |
| [98](/C:/AI_employee/playground/src/routes.cpp:98) | <code>        for (const auto&amp; [key, value] : request.params)</code> | Iterate over query parameters. |
| [99](/C:/AI_employee/playground/src/routes.cpp:99) | <code>            if (key != "status") throw std::invalid_argument("Unexpected query parameter");</code> | Reject query keys other than status. |
| [100](/C:/AI_employee/playground/src/routes.cpp:100) | <code>        if (request.get_param_value_count("status") &gt; 1) throw std::invalid_argument("Duplicate status parameter");</code> | Reject more than one occurrence of the status parameter. |
| [101](/C:/AI_employee/playground/src/routes.cpp:101) | <code>        auto status = request.get_param_value("status");</code> | Read status; cpp-httplib returns empty when that parameter is absent. |
| [102](/C:/AI_employee/playground/src/routes.cpp:102) | <code>        if (request.has_param("status") &amp;&amp; !valid_status(status)) throw std::invalid_argument("Unsupported status");</code> | When status was explicitly provided, require a supported enum. Thus no query is allowed, but status= with an empty value is rejected. |
| [103](/C:/AI_employee/playground/src/routes.cpp:103) | <code>        json tasks = json::array();</code> | Create a JSON array for result rows. |
| [104](/C:/AI_employee/playground/src/routes.cpp:104) | <code>        for (const auto&amp; task : repository.list_tasks(status)) tasks.push_back(task_json(task));</code> | Call list_tasks with the request filter, convert each returned Task to JSON and append it. This route does not independently re-filter rows, so the seeded repository bug is observable. |
| [105](/C:/AI_employee/playground/src/routes.cpp:105) | <code>        respond(response, 200, {{"tasks",tasks}});</code> | Return HTTP 200 with an object containing the tasks array. HTTP success alone does not prove those rows are correct. |
| [106](/C:/AI_employee/playground/src/routes.cpp:106) | <code>    }));</code> | Finish GET registration and its safe wrapper. |
| [107](/C:/AI_employee/playground/src/routes.cpp:107) | <code>    server.Post("/api/tasks", safe([&amp;repository](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Register POST /api/tasks for task creation. |
| [108](/C:/AI_employee/playground/src/routes.cpp:108) | <code>        auto body = parse_body(request,{"title","description","status"});</code> | Parse JSON, permitting only title, description and status string fields. |
| [109](/C:/AI_employee/playground/src/routes.cpp:109) | <code>        auto title = field(body,"title",120);</code> | Require a nonblank title within 120 bytes. |
| [110](/C:/AI_employee/playground/src/routes.cpp:110) | <code>        auto description = field(body,"description",1000,false);</code> | Accept optional description within 1000 bytes; absent description becomes empty. |
| [111](/C:/AI_employee/playground/src/routes.cpp:111) | <code>        auto status = body.contains("status") ? field(body,"status",20) : "todo";</code> | Use a supplied nonblank status within 20 bytes, otherwise default to todo. |
| [112](/C:/AI_employee/playground/src/routes.cpp:112) | <code>        if (!valid_status(status)) throw std::invalid_argument("Unsupported status");</code> | Reject unsupported status strings before inserting anything. |
| [113](/C:/AI_employee/playground/src/routes.cpp:113) | <code>        auto task = repository.create_task(title,description,status);</code> | Create the stored task through the repository. |
| [114](/C:/AI_employee/playground/src/routes.cpp:114) | <code>        respond(response,201,task_json(task));</code> | Return the new Task with HTTP 201 Created. |
| [115](/C:/AI_employee/playground/src/routes.cpp:115) | <code>    }));</code> | Finish POST registration. |
| [116](/C:/AI_employee/playground/src/routes.cpp:116) | <code>    server.Patch(R"(/api/tasks/(\d+))", safe([&amp;repository](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Register PATCH on a regex matching a numeric task ID. The C++ raw string preserves the regex backslash; parentheses capture the ID. |
| [117](/C:/AI_employee/playground/src/routes.cpp:117) | <code>        auto body = parse_body(request,{"status"});</code> | Permit only status in the JSON body. |
| [118](/C:/AI_employee/playground/src/routes.cpp:118) | <code>        auto status = field(body,"status",20);</code> | Require a nonblank status within 20 bytes. |
| [119](/C:/AI_employee/playground/src/routes.cpp:119) | <code>        if (!valid_status(status)) throw std::invalid_argument("Unsupported status");</code> | Validate the enum before SQL update. |
| [120](/C:/AI_employee/playground/src/routes.cpp:120) | <code>        auto task = repository.update_task(task_id(request),status);</code> | Parse ID and request the repository update. |
| [121](/C:/AI_employee/playground/src/routes.cpp:121) | <code>        if (!task) { respond(response,404,{{"error","Task not found"}}); return; }</code> | If optional is empty, return 404 and stop this handler. |
| [122](/C:/AI_employee/playground/src/routes.cpp:122) | <code>        respond(response,200,task_json(*task));</code> | Dereference the returned Task and return it with 200. |
| [123](/C:/AI_employee/playground/src/routes.cpp:123) | <code>    }));</code> | Finish PATCH registration. |
| [124](/C:/AI_employee/playground/src/routes.cpp:124) | <code>    server.Delete(R"(/api/tasks/(\d+))", safe([&amp;repository](const httplib::Request&amp; request, httplib::Response&amp; response) {</code> | Register DELETE on the same numeric-ID route shape. |
| [125](/C:/AI_employee/playground/src/routes.cpp:125) | <code>        if (!repository.delete_task(task_id(request))) { respond(response,404,{{"error","Task not found"}}); return; }</code> | Delete the parsed ID; return 404 if no row existed. |
| [126](/C:/AI_employee/playground/src/routes.cpp:126) | <code>        response.status = 204;</code> | Return 204 No Content on successful deletion; there is no JSON body to parse. |
| [127](/C:/AI_employee/playground/src/routes.cpp:127) | <code>    }));</code> | Finish DELETE registration. |
| [128](/C:/AI_employee/playground/src/routes.cpp:128) | <code>    server.set_payload_max_length(8192);</code> | Limit HTTP request payloads to 8192 bytes; this does not implement upload handling. |
| [129](/C:/AI_employee/playground/src/routes.cpp:129) | <code>    server.set_read_timeout(5,0);</code> | Set the socket read timeout to five seconds, zero additional microseconds. |
| [130](/C:/AI_employee/playground/src/routes.cpp:130) | <code>    server.set_write_timeout(5,0);</code> | Set the equivalent write timeout. |
| [131](/C:/AI_employee/playground/src/routes.cpp:131) | <code>}</code> | Close register_routes. |

### playground/src/main.cpp

[Open actual file](/C:/AI_employee/playground/src/main.cpp) · 38 lines · snapshot SHA256: 912ed93568634662a72c227559b95ee3a97a4107fa57a3b649da93e48eaba5ed

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/src/main.cpp:1) | <code>#include "routes.hpp"</code> | Include the route declaration, HTTP types and task repository declarations through routes.hpp. |
| [2](/C:/AI_employee/playground/src/main.cpp:2) | <code>#include &lt;filesystem&gt;</code> | Include filesystem path/exists operations used to check the static directory. |
| [3](/C:/AI_employee/playground/src/main.cpp:3) | <code>#include &lt;iostream&gt;</code> | Include standard console output/error streams. |
| [4](/C:/AI_employee/playground/src/main.cpp:4) | <code>#include &lt;stdexcept&gt;</code> | Include standard exception types, including invalid_argument and runtime_error. |
| [5](/C:/AI_employee/playground/src/main.cpp:5) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [6](/C:/AI_employee/playground/src/main.cpp:6) | <code>int main(int argc, char** argv) {</code> | Program entry point; argc counts arguments and argv contains their text. argv[0] is the executable name. |
| [7](/C:/AI_employee/playground/src/main.cpp:7) | <code>    try {</code> | Catch startup/argument/storage exceptions at the outer program boundary. |
| [8](/C:/AI_employee/playground/src/main.cpp:8) | <code>        std::string database, static_path, scenario = "clean";</code> | Database and static paths start empty; scenario defaults to clean. The scenario is a displayed label, not a defect switch. |
| [9](/C:/AI_employee/playground/src/main.cpp:9) | <code>        int port = 8080;</code> | Default local HTTP port is 8080. |
| [10](/C:/AI_employee/playground/src/main.cpp:10) | <code>        bool seed = false;</code> | Start in server mode; seed mode requires the --seed flag. |
| [11](/C:/AI_employee/playground/src/main.cpp:11) | <code>        for (int i=1; i&lt;argc; ++i) {</code> | Iterate through arguments after argv[0]. The loop increment and the value-consuming increment together advance over option/value pairs. |
| [12](/C:/AI_employee/playground/src/main.cpp:12) | <code>            std::string argument = argv[i];</code> | Copy this argument into a std::string. |
| [13](/C:/AI_employee/playground/src/main.cpp:13) | <code>            if (argument == "--seed") { seed = true; continue; }</code> | --seed takes no value: enable seed mode and proceed to the next argument. |
| [14](/C:/AI_employee/playground/src/main.cpp:14) | <code>            if (i+1 &gt;= argc) throw std::invalid_argument("Missing argument value");</code> | All other options need a following value; reject a missing one before reading past argv. |
| [15](/C:/AI_employee/playground/src/main.cpp:15) | <code>            std::string value = argv[++i];</code> | Pre-increment i to consume the value belonging to the option. |
| [16](/C:/AI_employee/playground/src/main.cpp:16) | <code>            if (argument == "--db") database = value;</code> | Set the database path for --db. |
| [17](/C:/AI_employee/playground/src/main.cpp:17) | <code>            else if (argument == "--static") static_path = value;</code> | Set the static-assets directory for --static. |
| [18](/C:/AI_employee/playground/src/main.cpp:18) | <code>            else if (argument == "--scenario") scenario = value; // Display only; never controls source behavior.</code> | Set the scenario label for --scenario; it never chooses an alternative query or layout. |
| [19](/C:/AI_employee/playground/src/main.cpp:19) | <code>            else if (argument == "--port") {</code> | Begin special parsing for --port. |
| [20](/C:/AI_employee/playground/src/main.cpp:20) | <code>                std::size_t consumed;</code> | Reserve storage for how many characters stoi consumes. |
| [21](/C:/AI_employee/playground/src/main.cpp:21) | <code>                port = std::stoi(value,&amp;consumed);</code> | Convert port text to an integer; conversion errors are exceptions handled by the outer catch. |
| [22](/C:/AI_employee/playground/src/main.cpp:22) | <code>                if (consumed != value.size() &#124;&#124; port &lt; 1024 &#124;&#124; port &gt; 65535) throw std::invalid_argument("Invalid port");</code> | Reject text with leftover characters and ports outside 1024 through 65535. |
| [23](/C:/AI_employee/playground/src/main.cpp:23) | <code>            } else throw std::invalid_argument("Unknown command-line argument");</code> | Reject any other option; this also closes the port option block. |
| [24](/C:/AI_employee/playground/src/main.cpp:24) | <code>        }</code> | End argument iteration. |
| [25](/C:/AI_employee/playground/src/main.cpp:25) | <code>        if (database.empty()) throw std::invalid_argument("--db is required");</code> | Require an explicitly selected database rather than guessing a shared data location. |
| [26](/C:/AI_employee/playground/src/main.cpp:26) | <code>        TaskRepository repository(database);</code> | Open/create the SQLite database through the repository constructor. Stack ownership means its destructor runs on normal return and stack unwinding. |
| [27](/C:/AI_employee/playground/src/main.cpp:27) | <code>        if (seed) { repository.reset_seed(); std::cout &lt;&lt; "Reset synthetic task data to four seeded rows.\n"; return 0; }</code> | In seed mode, reset synthetic rows, print acknowledgment and exit successfully without starting an HTTP server. The constructor has already ensured the table exists. |
| [28](/C:/AI_employee/playground/src/main.cpp:28) | <code>        if (static_path.empty() &#124;&#124; !std::filesystem::exists(std::filesystem::path(static_path)/"index.html"))</code> | For server mode, require the static directory to contain index.html. |
| [29](/C:/AI_employee/playground/src/main.cpp:29) | <code>            throw std::invalid_argument("--static must contain index.html");</code> | Throw a clear startup error if the preceding check failed. |
| [30](/C:/AI_employee/playground/src/main.cpp:30) | <code>        httplib::Server server;</code> | Create the cpp-httplib HTTP server object. |
| [31](/C:/AI_employee/playground/src/main.cpp:31) | <code>        server.new_task_queue = [] { return new httplib::ThreadPool(4); };</code> | Supply a factory returning a four-thread HTTP task queue; cpp-httplib owns the returned queue. This is HTTP request concurrency, not a DevDesk worker scheduler. |
| [32](/C:/AI_employee/playground/src/main.cpp:32) | <code>        register_routes(server, repository, port, scenario);</code> | Register API routes, guards and response headers, passing the repository by reference. |
| [33](/C:/AI_employee/playground/src/main.cpp:33) | <code>        if (!server.set_mount_point("/",static_path)) throw std::runtime_error("Static mount failed");</code> | Mount static files at /. index.html, app.js and styles.css are served from the selected build/static snapshot; fail if mounting fails. |
| [34](/C:/AI_employee/playground/src/main.cpp:34) | <code>        std::cout &lt;&lt; "Team Tasks (" &lt;&lt; scenario &lt;&lt; ") http://127.0.0.1:" &lt;&lt; port &lt;&lt; "\n" &lt;&lt; std::flush;</code> | Print the scenario and local URL and flush stdout so launchers can observe startup text immediately. |
| [35](/C:/AI_employee/playground/src/main.cpp:35) | <code>        if (!server.listen("127.0.0.1",port)) throw std::runtime_error("Could not listen; port may already be in use");</code> | Listen on loopback only. listen blocks while serving; a bind/listen failure throws a startup error. |
| [36](/C:/AI_employee/playground/src/main.cpp:36) | <code>    } catch (const std::exception&amp; error) { std::cerr &lt;&lt; error.what() &lt;&lt; '\n'; return 1; }</code> | Print an exception message to stderr and return process exit code 1. |
| [37](/C:/AI_employee/playground/src/main.cpp:37) | <code>    return 0;</code> | Return process exit code 0 after a normal server return. |
| [38](/C:/AI_employee/playground/src/main.cpp:38) | <code>}</code> | Close main. |

### playground/static/index.html

[Open actual file](/C:/AI_employee/playground/static/index.html) · 47 lines · snapshot SHA256: 03e9048aa3f636e5b831470ab01134e87a3dd4fb0728eefeacaef49903aa4579

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/static/index.html:1) | <code>&lt;!doctype html&gt;</code> | Tell the browser to use HTML5 standards mode. |
| [2](/C:/AI_employee/playground/static/index.html:2) | <code>&lt;html lang="en"&gt;</code> | Start the HTML document and declare English for accessibility/language processing. |
| [3](/C:/AI_employee/playground/static/index.html:3) | <code>&lt;head&gt;</code> | Start metadata/resources rather than visible page content. |
| [4](/C:/AI_employee/playground/static/index.html:4) | <code>  &lt;meta charset="utf-8"&gt;</code> | Decode this document as UTF-8, preserving the checkmark, arrow and punctuation. |
| [5](/C:/AI_employee/playground/static/index.html:5) | <code>  &lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code> | Make the layout viewport match device width and start at normal scale; needed for responsive media queries. |
| [6](/C:/AI_employee/playground/static/index.html:6) | <code>  &lt;title&gt;Team Tasks · DevDesk Playground&lt;/title&gt;</code> | Set the browser tab title. |
| [7](/C:/AI_employee/playground/static/index.html:7) | <code>  &lt;link rel="stylesheet" href="/styles.css"&gt;</code> | Load CSS from the current server's /styles.css route. |
| [8](/C:/AI_employee/playground/static/index.html:8) | <code>  &lt;script src="/app.js" defer&gt;&lt;/script&gt;</code> | Load app.js with defer so it runs after HTML parsing; selectors can then find the form/template. |
| [9](/C:/AI_employee/playground/static/index.html:9) | <code>&lt;/head&gt;</code> | Close the head. |
| [10](/C:/AI_employee/playground/static/index.html:10) | <code>&lt;body&gt;</code> | Start visible document content. |
| [11](/C:/AI_employee/playground/static/index.html:11) | <code>  &lt;header class="topbar"&gt;&lt;a class="brand" href="/" aria-label="Team Tasks home"&gt;&lt;span class="brand-icon"&gt;✓&lt;/span&gt; Team Tasks&lt;/a&gt;&lt;span class="workspace-label"&gt;SYNTHETIC WORKSPACE&lt;/span&gt;&lt;/header&gt;</code> | Create the top bar, home link, checkmark and synthetic-workspace label; aria-label names the link for assistive technology. |
| [12](/C:/AI_employee/playground/static/index.html:12) | <code>  &lt;main&gt;</code> | Start the page's main content landmark. |
| [13](/C:/AI_employee/playground/static/index.html:13) | <code>    &lt;section class="intro"&gt;&lt;p class="eyebrow"&gt;YOUR TEAM, IN MOTION&lt;/p&gt;&lt;h1&gt;A little clarity.&lt;br&gt;A lot of progress.&lt;/h1&gt;&lt;p class="subtitle"&gt;Capture the next step and keep your team's work moving.&lt;/p&gt;&lt;p id="scenario" class="scenario"&gt;Loading playground…&lt;/p&gt;&lt;/section&gt;</code> | Create introductory text and #scenario, which JavaScript later replaces using health metadata. |
| [14](/C:/AI_employee/playground/static/index.html:14) | <code>    &lt;div class="workspace"&gt;</code> | Open the workspace layout container holding form and board. |
| [15](/C:/AI_employee/playground/static/index.html:15) | <code>      &lt;aside class="create-panel"&gt;</code> | Start the creation sidebar panel. |
| [16](/C:/AI_employee/playground/static/index.html:16) | <code>        &lt;div class="section-heading"&gt;&lt;span class="plus"&gt;+&lt;/span&gt;&lt;h2&gt;Create a task&lt;/h2&gt;&lt;/div&gt;</code> | Show plus icon and Create a task heading. |
| [17](/C:/AI_employee/playground/static/index.html:17) | <code>        &lt;p class="muted"&gt;Small steps make good work.&lt;/p&gt;</code> | Show explanatory form text. |
| [18](/C:/AI_employee/playground/static/index.html:18) | <code>        &lt;form id="create-form"&gt;</code> | Create #create-form, whose submit event app.js intercepts. |
| [19](/C:/AI_employee/playground/static/index.html:19) | <code>          &lt;label for="title"&gt;Task title&lt;/label&gt;&lt;input id="title" name="title" required maxlength="120" placeholder="What needs to happen?"&gt;</code> | Associate the Task title label with #title; require input, enforce browser maxlength of 120 characters and show a placeholder. |
| [20](/C:/AI_employee/playground/static/index.html:20) | <code>          &lt;label for="description"&gt;Details &lt;span class="optional"&gt;optional&lt;/span&gt;&lt;/label&gt;&lt;textarea id="description" name="description" maxlength="1000" rows="4" placeholder="A little context goes a long way."&gt;&lt;/textarea&gt;</code> | Associate the optional Details label with #description; give a four-row textarea and a 1000-character browser limit. |
| [21](/C:/AI_employee/playground/static/index.html:21) | <code>          &lt;button type="submit" class="primary" id="create-button"&gt;Create task &lt;span aria-hidden="true"&gt;↗&lt;/span&gt;&lt;/button&gt;</code> | Create the submit button; the decorative arrow is hidden from the accessible name. |
| [22](/C:/AI_employee/playground/static/index.html:22) | <code>        &lt;/form&gt;</code> | Close the form. |
| [23](/C:/AI_employee/playground/static/index.html:23) | <code>        &lt;p class="panel-note"&gt;Saved to the playground database.&lt;br&gt;Your tasks stay here after a refresh.&lt;/p&gt;</code> | Explain persistence to the user; br makes a line break. |
| [24](/C:/AI_employee/playground/static/index.html:24) | <code>      &lt;/aside&gt;</code> | Close the sidebar. |
| [25](/C:/AI_employee/playground/static/index.html:25) | <code>      &lt;section class="board" aria-labelledby="board-heading"&gt;</code> | Start the board region, named by #board-heading. |
| [26](/C:/AI_employee/playground/static/index.html:26) | <code>        &lt;div class="board-heading"&gt;&lt;div&gt;&lt;p class="eyebrow"&gt;THE TASK BOARD&lt;/p&gt;&lt;h2 id="board-heading"&gt;What's next&lt;/h2&gt;&lt;/div&gt;&lt;span id="task-count" class="count"&gt;0 tasks&lt;/span&gt;&lt;/div&gt;</code> | Create board heading and the count placeholder that JavaScript updates after fetching rows. |
| [27](/C:/AI_employee/playground/static/index.html:27) | <code>        &lt;nav class="filters" aria-label="Filter tasks"&gt;</code> | Start filter navigation with an accessible label. |
| [28](/C:/AI_employee/playground/static/index.html:28) | <code>          &lt;button type="button" data-filter="" aria-pressed="true"&gt;All tasks&lt;/button&gt;</code> | Create All tasks with empty data-filter; initially mark it pressed. Empty filter causes JavaScript to omit the status query parameter. |
| [29](/C:/AI_employee/playground/static/index.html:29) | <code>          &lt;button type="button" data-filter="todo" aria-pressed="false"&gt;To do&lt;/button&gt;</code> | Create To do with data-filter=todo; its visible spelling differs from the API enum. |
| [30](/C:/AI_employee/playground/static/index.html:30) | <code>          &lt;button type="button" data-filter="in_progress" aria-pressed="false"&gt;In progress&lt;/button&gt;</code> | Create In progress with data-filter=in_progress. No Completed button is present; that is the future feature baseline. |
| [31](/C:/AI_employee/playground/static/index.html:31) | <code>        &lt;/nav&gt;</code> | Close filter navigation. |
| [32](/C:/AI_employee/playground/static/index.html:32) | <code>        &lt;p id="notice" role="status" aria-live="polite"&gt;&lt;/p&gt;</code> | Create #notice as a politely announced status-message region for success/error text. |
| [33](/C:/AI_employee/playground/static/index.html:33) | <code>        &lt;div id="task-list" class="task-list" aria-busy="true"&gt;&lt;/div&gt;</code> | Create the initially empty task-list container and mark its initial loading state. |
| [34](/C:/AI_employee/playground/static/index.html:34) | <code>        &lt;p id="empty" class="empty" hidden&gt;No tasks here yet. Create one to get started.&lt;/p&gt;</code> | Create the initially hidden empty-result message; JavaScript toggles the hidden property. |
| [35](/C:/AI_employee/playground/static/index.html:35) | <code>      &lt;/section&gt;</code> | Close the board. |
| [36](/C:/AI_employee/playground/static/index.html:36) | <code>    &lt;/div&gt;</code> | Close workspace layout. |
| [37](/C:/AI_employee/playground/static/index.html:37) | <code>    &lt;footer&gt;DevDesk playground &lt;span&gt;Fictional team. Real persistence.&lt;/span&gt;&lt;/footer&gt;</code> | Show the footer and synthetic-data/persistence reminder. |
| [38](/C:/AI_employee/playground/static/index.html:38) | <code>  &lt;/main&gt;</code> | Close main. |
| [39](/C:/AI_employee/playground/static/index.html:39) | <code>  &lt;template id="task-template"&gt;</code> | Start an inert HTML template: its contents are not rendered until JavaScript clones them. |
| [40](/C:/AI_employee/playground/static/index.html:40) | <code>    &lt;article class="task-card"&gt;</code> | Define one card article within that template. |
| [41](/C:/AI_employee/playground/static/index.html:41) | <code>      &lt;div class="card-top"&gt;&lt;span class="status-badge"&gt;&lt;/span&gt;&lt;span class="task-id"&gt;&lt;/span&gt;&lt;/div&gt;</code> | Provide empty badge and ID elements filled from each task. |
| [42](/C:/AI_employee/playground/static/index.html:42) | <code>      &lt;h3&gt;&lt;/h3&gt;&lt;p class="task-description"&gt;&lt;/p&gt;</code> | Provide title and description elements filled with textContent. |
| [43](/C:/AI_employee/playground/static/index.html:43) | <code>      &lt;div class="task-actions"&gt;&lt;button type="button" class="advance"&gt;Start task&lt;/button&gt;&lt;button type="button" class="remove"&gt;Remove task&lt;/button&gt;&lt;/div&gt;</code> | Provide status-advance and remove buttons. type=button prevents accidental form submission; action text/listeners are set per task. |
| [44](/C:/AI_employee/playground/static/index.html:44) | <code>    &lt;/article&gt;</code> | Close template card. |
| [45](/C:/AI_employee/playground/static/index.html:45) | <code>  &lt;/template&gt;</code> | Close the template. |
| [46](/C:/AI_employee/playground/static/index.html:46) | <code>&lt;/body&gt;</code> | Close visible body. |
| [47](/C:/AI_employee/playground/static/index.html:47) | <code>&lt;/html&gt;</code> | Close the document. |

### playground/static/app.js

[Open actual file](/C:/AI_employee/playground/static/app.js) · 89 lines · snapshot SHA256: 9dc917a470609387d4d86d010a36c0c00e66f2a68c515a3108680039f42c81e2

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/static/app.js:1) | <code>'use strict';</code> | Enable strict JavaScript semantics for this script. |
| [2](/C:/AI_employee/playground/static/app.js:2) | <code>const labels = {todo: 'To do', in_progress: 'In progress', done: 'Completed'};</code> | Map stored status enums to human-readable badge labels. |
| [3](/C:/AI_employee/playground/static/app.js:3) | <code>const nextStatus = {todo: 'in_progress', in_progress: 'done', done: 'todo'};</code> | Define the status cycle used by the advance button: todo -&gt; in_progress -&gt; done -&gt; todo. |
| [4](/C:/AI_employee/playground/static/app.js:4) | <code>const actionLabels = {todo: 'Start task', in_progress: 'Complete task', done: 'Reopen task'};</code> | Map the current task status to its next-action button text. |
| [5](/C:/AI_employee/playground/static/app.js:5) | <code>let currentFilter = '';</code> | Start with no status filter, meaning All tasks. |
| [6](/C:/AI_employee/playground/static/app.js:6) | <code>let loadingVersion = 0;</code> | Initialize a monotonically increasing request generation number to avoid stale load results overwriting newer ones. |
| [7](/C:/AI_employee/playground/static/app.js:7) | <code>const notice = document.querySelector('#notice');</code> | Find the shared success/error message element once. |
| [8](/C:/AI_employee/playground/static/app.js:8) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [9](/C:/AI_employee/playground/static/app.js:9) | <code>async function api(path, options = {}) {</code> | Define an asynchronous JSON API helper with default empty fetch options. |
| [10](/C:/AI_employee/playground/static/app.js:10) | <code>  const response = await fetch(path, options);</code> | Send the HTTP request using a relative URL on the same origin and wait for its response. |
| [11](/C:/AI_employee/playground/static/app.js:11) | <code>  const data = response.status === 204 ? null : await response.json();</code> | 204 has no body; other responses are expected to contain JSON and are parsed. |
| [12](/C:/AI_employee/playground/static/app.js:12) | <code>  if (!response.ok) throw new Error(data?.error &#124;&#124; `Request failed (${response.status})`);</code> | For an HTTP error, throw the API's error text or a status-based fallback; callers catch it for display. |
| [13](/C:/AI_employee/playground/static/app.js:13) | <code>  return data;</code> | Return parsed data to the caller. |
| [14](/C:/AI_employee/playground/static/app.js:14) | <code>}</code> | Close api. |
| [15](/C:/AI_employee/playground/static/app.js:15) | <code>function message(text, error = false) {</code> | Define the message display helper; success styling is the default. |
| [16](/C:/AI_employee/playground/static/app.js:16) | <code>  notice.textContent = text;</code> | Set literal notice text, without interpreting it as HTML. |
| [17](/C:/AI_employee/playground/static/app.js:17) | <code>  notice.classList.toggle('error', error);</code> | Add/remove the error CSS class based on the boolean. |
| [18](/C:/AI_employee/playground/static/app.js:18) | <code>}</code> | Close message. |
| [19](/C:/AI_employee/playground/static/app.js:19) | <code>async function loadTasks() {</code> | Define retrieval and rendering of the current filtered task list. |
| [20](/C:/AI_employee/playground/static/app.js:20) | <code>  const version = ++loadingVersion;</code> | Increment the global generation and remember this request's generation locally. |
| [21](/C:/AI_employee/playground/static/app.js:21) | <code>  const list = document.querySelector('#task-list');</code> | Get the card-list container. |
| [22](/C:/AI_employee/playground/static/app.js:22) | <code>  list.setAttribute('aria-busy', 'true');</code> | Mark loading for assistive technology and test synchronization. |
| [23](/C:/AI_employee/playground/static/app.js:23) | <code>  try {</code> | Catch network/API/rendering failures during this load. |
| [24](/C:/AI_employee/playground/static/app.js:24) | <code>    const data = await api('/api/tasks' + (currentFilter ? `?status=${encodeURIComponent(currentFilter)}` : ''));</code> | GET /api/tasks for All, or add an encoded status value for a filter. encodeURIComponent makes a safe URL component; it is not SQL validation. |
| [25](/C:/AI_employee/playground/static/app.js:25) | <code>    if (version !== loadingVersion) return;</code> | Discard a response whose generation is older than the latest load. An in-flight network request is not actually cancelled here. |
| [26](/C:/AI_employee/playground/static/app.js:26) | <code>    list.replaceChildren();</code> | Remove the previous cards before rendering this accepted result. |
| [27](/C:/AI_employee/playground/static/app.js:27) | <code>    for (const task of data.tasks) {</code> | Loop over tasks returned by the backend; this loop does not independently verify/re-filter their statuses. |
| [28](/C:/AI_employee/playground/static/app.js:28) | <code>      const card = document.querySelector('#task-template').content.firstElementChild.cloneNode(true);</code> | Deep-clone the card template including its inner elements. |
| [29](/C:/AI_employee/playground/static/app.js:29) | <code>      card.dataset.taskId = String(task.id);</code> | Record the task ID as a string-valued data-task-id attribute, useful for DOM identification/tests. |
| [30](/C:/AI_employee/playground/static/app.js:30) | <code>      card.querySelector('h3').textContent = task.title;</code> | Render the title as text, preventing submitted markup from becoming elements. |
| [31](/C:/AI_employee/playground/static/app.js:31) | <code>      card.querySelector('.task-description').textContent = task.description &#124;&#124; 'No details added.';</code> | Render description as text, or use a fallback when it is empty. |
| [32](/C:/AI_employee/playground/static/app.js:32) | <code>      card.querySelector('.task-id').textContent = `#${String(task.id).padStart(3, '0')}`;</code> | Render the ID as #001, #002, etc. padStart changes presentation only, not the numeric database ID. |
| [33](/C:/AI_employee/playground/static/app.js:33) | <code>      const badge = card.querySelector('.status-badge');</code> | Find the status badge inside this card. |
| [34](/C:/AI_employee/playground/static/app.js:34) | <code>      badge.textContent = labels[task.status];</code> | Set its human-readable label. |
| [35](/C:/AI_employee/playground/static/app.js:35) | <code>      badge.classList.add(task.status);</code> | Add its enum as a CSS class to select the badge color. |
| [36](/C:/AI_employee/playground/static/app.js:36) | <code>      const advance = card.querySelector('.advance');</code> | Find the advance button. |
| [37](/C:/AI_employee/playground/static/app.js:37) | <code>      advance.textContent = actionLabels[task.status];</code> | Set action text appropriate to the task's current status. |
| [38](/C:/AI_employee/playground/static/app.js:38) | <code>      advance.setAttribute('aria-label', `${actionLabels[task.status]}: ${task.title}`);</code> | Set a unique accessible name combining the action and title. |
| [39](/C:/AI_employee/playground/static/app.js:39) | <code>      advance.addEventListener('click', () =&gt; mutate(card, `/api/tasks/${task.id}`, 'PATCH', {status: nextStatus[task.status]}, 'Task status updated.'));</code> | Register a click that PATCHes the next status using mutate. The closure remembers this task and ID until the card is replaced. |
| [40](/C:/AI_employee/playground/static/app.js:40) | <code>      const remove = card.querySelector('.remove');</code> | Find the remove button. |
| [41](/C:/AI_employee/playground/static/app.js:41) | <code>      remove.setAttribute('aria-label', `Remove task: ${task.title}`);</code> | Give it a task-specific accessible name. |
| [42](/C:/AI_employee/playground/static/app.js:42) | <code>      remove.addEventListener('click', () =&gt; {</code> | Register its click callback. |
| [43](/C:/AI_employee/playground/static/app.js:43) | <code>        if (window.confirm(`Remove “${task.title}” from this synthetic workspace?`))</code> | Ask the human to confirm removal from the synthetic workspace. |
| [44](/C:/AI_employee/playground/static/app.js:44) | <code>          mutate(card, `/api/tasks/${task.id}`, 'DELETE', null, 'Task removed.');</code> | On confirmation, issue DELETE without a JSON body through mutate. |
| [45](/C:/AI_employee/playground/static/app.js:45) | <code>      });</code> | Close removal callback registration. |
| [46](/C:/AI_employee/playground/static/app.js:46) | <code>      list.append(card);</code> | Append the completed card to the list. |
| [47](/C:/AI_employee/playground/static/app.js:47) | <code>    }</code> | Close the task loop. |
| [48](/C:/AI_employee/playground/static/app.js:48) | <code>    document.querySelector('#empty').hidden = data.tasks.length !== 0;</code> | Show the empty-state element exactly when there are zero result rows. |
| [49](/C:/AI_employee/playground/static/app.js:49) | <code>    document.querySelector('#task-count').textContent = `${data.tasks.length} ${data.tasks.length === 1 ? 'task' : 'tasks'}`;</code> | Display result-row count, using singular/plural wording. This is a filtered count, not a separate global total. |
| [50](/C:/AI_employee/playground/static/app.js:50) | <code>  } catch (error) { if (version === loadingVersion) message(error.message, true); }</code> | For the latest request only, show an error message when load fails. A stale failure must not replace a newer request's notice. |
| [51](/C:/AI_employee/playground/static/app.js:51) | <code>  finally { if (version === loadingVersion) list.setAttribute('aria-busy', 'false'); }</code> | For the latest request only, clear the loading state even after a caught failure. |
| [52](/C:/AI_employee/playground/static/app.js:52) | <code>}</code> | Close loadTasks. |
| [53](/C:/AI_employee/playground/static/app.js:53) | <code>async function mutate(card, path, method, body, success) {</code> | Define a reusable task-write helper receiving card, API path, method, optional body and success message. |
| [54](/C:/AI_employee/playground/static/app.js:54) | <code>  const buttons = [...card.querySelectorAll('button')];</code> | Copy this card's buttons into a normal array. |
| [55](/C:/AI_employee/playground/static/app.js:55) | <code>  buttons.forEach(button =&gt; button.disabled = true);</code> | Temporarily disable both buttons to reduce double clicks during this particular write. |
| [56](/C:/AI_employee/playground/static/app.js:56) | <code>  try {</code> | Catch write/load errors. |
| [57](/C:/AI_employee/playground/static/app.js:57) | <code>    await api(path, {method, ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})});</code> | Perform the request; when body exists add JSON Content-Type and serialized body, otherwise use only method (DELETE). |
| [58](/C:/AI_employee/playground/static/app.js:58) | <code>    message(success);</code> | Show the supplied success message after the write succeeds. |
| [59](/C:/AI_employee/playground/static/app.js:59) | <code>    await loadTasks();</code> | Reload tasks from the database rather than guessing their new state locally. |
| [60](/C:/AI_employee/playground/static/app.js:60) | <code>  } catch (error) { message(error.message, true); }</code> | Display any failure as an error message. |
| [61](/C:/AI_employee/playground/static/app.js:61) | <code>  finally { buttons.forEach(button =&gt; button.disabled = false); }</code> | Re-enable the captured buttons on success or failure; successful reload may already have replaced their card in the DOM. |
| [62](/C:/AI_employee/playground/static/app.js:62) | <code>}</code> | Close mutate. |
| [63](/C:/AI_employee/playground/static/app.js:63) | <code>document.querySelector('#create-form').addEventListener('submit', async event =&gt; {</code> | Register an async form submission callback. |
| [64](/C:/AI_employee/playground/static/app.js:64) | <code>  event.preventDefault();</code> | Prevent the browser's default navigation/form submission. |
| [65](/C:/AI_employee/playground/static/app.js:65) | <code>  const button = document.querySelector('#create-button');</code> | Find the create submit button. |
| [66](/C:/AI_employee/playground/static/app.js:66) | <code>  const title = document.querySelector('#title').value.trim();</code> | Read and trim the title on the browser side. |
| [67](/C:/AI_employee/playground/static/app.js:67) | <code>  if (!title) { message('Give the task a title.', true); return; }</code> | Reject an empty trimmed title with a user-visible message and no network call. |
| [68](/C:/AI_employee/playground/static/app.js:68) | <code>  button.disabled = true;</code> | Disable the create button during the request. |
| [69](/C:/AI_employee/playground/static/app.js:69) | <code>  try {</code> | Catch creation/load failures. |
| [70](/C:/AI_employee/playground/static/app.js:70) | <code>    await api('/api/tasks', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title, description: document.querySelector('#description').value.trim()})});</code> | POST title and trimmed description as JSON. Status is omitted, so the C++ route defaults it to todo. |
| [71](/C:/AI_employee/playground/static/app.js:71) | <code>    event.target.reset();</code> | Clear form inputs after successful creation; reset here is an HTML form reset, not a database reset. |
| [72](/C:/AI_employee/playground/static/app.js:72) | <code>    message('Task created and saved.');</code> | Show successful persistence acknowledgment. |
| [73](/C:/AI_employee/playground/static/app.js:73) | <code>    await loadTasks();</code> | Reload the current filter's rows. A new todo task may be absent if the user currently views In progress. |
| [74](/C:/AI_employee/playground/static/app.js:74) | <code>  } catch (error) { message(error.message, true); }</code> | Display request failure text. |
| [75](/C:/AI_employee/playground/static/app.js:75) | <code>  finally { button.disabled = false; }</code> | Re-enable the submit button regardless of outcome. |
| [76](/C:/AI_employee/playground/static/app.js:76) | <code>});</code> | Finish form callback registration. |
| [77](/C:/AI_employee/playground/static/app.js:77) | <code>document.querySelectorAll('[data-filter]').forEach(button =&gt; {</code> | Find every element carrying data-filter and iterate over those filter buttons. |
| [78](/C:/AI_employee/playground/static/app.js:78) | <code>  button.addEventListener('click', () =&gt; {</code> | Register a click callback for each filter. |
| [79](/C:/AI_employee/playground/static/app.js:79) | <code>    currentFilter = button.dataset.filter;</code> | Read the stored enum (or empty string) into currentFilter. |
| [80](/C:/AI_employee/playground/static/app.js:80) | <code>    document.querySelectorAll('[data-filter]').forEach(item =&gt; item.setAttribute('aria-pressed', String(item === button)));</code> | Mark only the clicked filter aria-pressed=true; other buttons are false. |
| [81](/C:/AI_employee/playground/static/app.js:81) | <code>    message('');</code> | Clear old notice text. |
| [82](/C:/AI_employee/playground/static/app.js:82) | <code>    loadTasks();</code> | Start a task reload for the new filter. |
| [83](/C:/AI_employee/playground/static/app.js:83) | <code>  });</code> | Close the filter click callback. |
| [84](/C:/AI_employee/playground/static/app.js:84) | <code>});</code> | Close filter-button iteration. |
| [85](/C:/AI_employee/playground/static/app.js:85) | <code>api('/api/health').then(health =&gt; {</code> | Fetch read-only build/scenario metadata asynchronously. |
| [86](/C:/AI_employee/playground/static/app.js:86) | <code>  const descriptions = {clean: 'Clean baseline', frontend: 'Frontend defect fixture · inspect at 390 × 844', backend: 'Backend defect fixture · check the To do filter', feature: 'Feature baseline · Completed filter is not available yet'};</code> | Map scenario labels to visible developer fixture explanations. These are labels, not repair patches or backend behavior switches. |
| [87](/C:/AI_employee/playground/static/app.js:87) | <code>  document.querySelector('#scenario').textContent = descriptions[health.scenario] &#124;&#124; 'Local playground';</code> | Update the scenario notice with a known label or a fallback. |
| [88](/C:/AI_employee/playground/static/app.js:88) | <code>}).catch(error =&gt; message(error.message, true));</code> | Display a health metadata request failure. |
| [89](/C:/AI_employee/playground/static/app.js:89) | <code>loadTasks();</code> | Start the initial task fetch; it can run while the health request is in flight. |

### playground/static/styles.css

[Open actual file](/C:/AI_employee/playground/static/styles.css) · 59 lines · snapshot SHA256: 611ee429e4d8e3ae6f3e6f0efe7b4c057d8a24866a1b820e44fac9bf0d375e59

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/static/styles.css:1) | <code>:root { color-scheme: light; --ink: #243a36; --muted: #697d76; --green: #286550; --line: #dce4dc; --paper: #f6f7f1; }</code> | Set light color scheme and reusable theme variables: dark ink, muted text, green accent, border line and paper background. |
| [2](/C:/AI_employee/playground/static/styles.css:2) | <code>* { box-sizing: border-box; }</code> | Use border-box globally so declared width includes padding/borders. |
| [3](/C:/AI_employee/playground/static/styles.css:3) | <code>body { margin: 0; color: var(--ink); background: var(--paper); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 15px; }</code> | Remove body margin; set theme colors, system UI font stack and base 15px size. |
| [4](/C:/AI_employee/playground/static/styles.css:4) | <code>button, input, textarea { font: inherit; }</code> | Make buttons and inputs inherit typography instead of browser-specific defaults. |
| [5](/C:/AI_employee/playground/static/styles.css:5) | <code>button { cursor: pointer; }</code> | Give buttons a pointing-hand cursor. |
| [6](/C:/AI_employee/playground/static/styles.css:6) | <code>button:disabled { opacity: .55; cursor: wait; }</code> | Dim disabled buttons and show wait cursor while a request is in flight. |
| [7](/C:/AI_employee/playground/static/styles.css:7) | <code>button:focus-visible, a:focus-visible { outline: 3px solid #a67a36; outline-offset: 4px; }</code> | Add a visible focus outline and spacing for keyboard-focused links/buttons. |
| [8](/C:/AI_employee/playground/static/styles.css:8) | <code>.topbar { max-width: 1240px; margin: auto; padding: 25px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }</code> | Constrain and center topbar to 1240px, add padding, align its two sides with flex and draw a bottom border. |
| [9](/C:/AI_employee/playground/static/styles.css:9) | <code>.brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 650; color: var(--ink); text-decoration: none; }</code> | Style the brand link as a horizontal icon/text group with heavier text and no underline. |
| [10](/C:/AI_employee/playground/static/styles.css:10) | <code>.brand-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--green); color: white; }</code> | Center a white checkmark inside a small green rounded square using grid. |
| [11](/C:/AI_employee/playground/static/styles.css:11) | <code>.workspace-label { font-size: 10px; letter-spacing: 1.8px; color: var(--muted); }</code> | Style the synthetic-workspace label with small spaced letters and muted color. |
| [12](/C:/AI_employee/playground/static/styles.css:12) | <code>main { max-width: 1240px; margin: auto; padding: 40px; }</code> | Constrain/center main to the same page width with 40px padding. |
| [13](/C:/AI_employee/playground/static/styles.css:13) | <code>.intro { margin-bottom: 34px; }</code> | Separate the introductory section from the workspace below. |
| [14](/C:/AI_employee/playground/static/styles.css:14) | <code>.eyebrow { color: var(--green); font-size: 10px; font-weight: 700; letter-spacing: 2px; margin: 0 0 12px; }</code> | Style small eyebrow captions using green uppercase-like letter spacing and weight. |
| [15](/C:/AI_employee/playground/static/styles.css:15) | <code>h1 { font-size: clamp(32px, 4.2vw, 48px); letter-spacing: -2px; line-height: 1.12; font-weight: 600; margin: 0; }</code> | Make h1 responsive using clamp (32px minimum, 4.2vw fluid, 48px maximum), tight line height/letter spacing and no default margin. |
| [16](/C:/AI_employee/playground/static/styles.css:16) | <code>.subtitle { color: var(--muted); line-height: 1.6; margin: 17px 0 10px; }</code> | Style subtitle color, line height and vertical spacing. |
| [17](/C:/AI_employee/playground/static/styles.css:17) | <code>.scenario { display: inline-block; font-size: 11px; color: #58674b; background: #e9edde; border-radius: 5px; padding: 7px 10px; margin: 0; }</code> | Make the fixture/scenario label a compact colored inline block with padding and rounded corners. |
| [18](/C:/AI_employee/playground/static/styles.css:18) | <code>.workspace { display: grid; grid-template-columns: 295px minmax(0,1fr); gap: 36px; align-items: start; }</code> | Lay out form and board as a 295px sidebar plus a flexible non-overflowing column; align to top and separate by 36px. |
| [19](/C:/AI_employee/playground/static/styles.css:19) | <code>.create-panel { background: #edf1e7; border: 1px solid #dce3d4; border-radius: 16px; padding: 24px; }</code> | Style creation panel background, border, rounded corners and internal padding. |
| [20](/C:/AI_employee/playground/static/styles.css:20) | <code>.section-heading { display: flex; align-items: center; gap: 10px; }</code> | Align plus icon and panel heading horizontally. |
| [21](/C:/AI_employee/playground/static/styles.css:21) | <code>.plus { font-size: 25px; color: var(--green); line-height: 1; }</code> | Style plus icon size/color/line height. |
| [22](/C:/AI_employee/playground/static/styles.css:22) | <code>h2 { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -.5px; }</code> | Style h2 size, weight and tight spacing while removing default margins. |
| [23](/C:/AI_employee/playground/static/styles.css:23) | <code>.create-panel h2 { font-size: 18px; }</code> | Use a slightly smaller h2 specifically in the form panel. |
| [24](/C:/AI_employee/playground/static/styles.css:24) | <code>.muted { color: var(--muted); font-size: 12px; margin: 10px 0 25px; }</code> | Style the panel's muted introductory text and space it from the form. |
| [25](/C:/AI_employee/playground/static/styles.css:25) | <code>label { display: block; font-size: 12px; font-weight: 600; margin: 20px 0 8px; }</code> | Make labels block elements, small/heavier text and spaced above inputs. |
| [26](/C:/AI_employee/playground/static/styles.css:26) | <code>.optional { color: var(--muted); font-weight: 400; margin-left: 4px; }</code> | Style optional-label annotation with lighter color/weight and slight left spacing. |
| [27](/C:/AI_employee/playground/static/styles.css:27) | <code>input, textarea { width: 100%; color: var(--ink); background: #fafbf7; border: 1px solid #d3dccc; border-radius: 7px; padding: 11px 12px; font-size: 12px; line-height: 1.6; }</code> | Make input/textarea full width with themed background/border, rounded corners, padding, small text and comfortable line height. |
| [28](/C:/AI_employee/playground/static/styles.css:28) | <code>textarea { resize: vertical; }</code> | Allow vertical textarea resizing only. |
| [29](/C:/AI_employee/playground/static/styles.css:29) | <code>input:focus, textarea:focus { outline: 2px solid #739581; outline-offset: 1px; }</code> | Give focused inputs/textareas a visible outline. |
| [30](/C:/AI_employee/playground/static/styles.css:30) | <code>.primary { width: 100%; display: flex; justify-content: space-between; margin-top: 23px; padding: 12px 14px; background: var(--green); color: white; border: 0; border-radius: 7px; font-size: 12px; font-weight: 600; }</code> | Style the primary submit button as full-width green flex layout with arrow at the right, padding, white bold text and rounded corners. |
| [31](/C:/AI_employee/playground/static/styles.css:31) | <code>.primary:hover { background: #1e503e; }</code> | Darken primary button on hover. |
| [32](/C:/AI_employee/playground/static/styles.css:32) | <code>.panel-note { font-size: 10px; color: var(--muted); line-height: 1.7; margin: 22px 0 0; }</code> | Style persistence note as small muted text with line spacing and top margin. |
| [33](/C:/AI_employee/playground/static/styles.css:33) | <code>.board-heading { display: flex; align-items: center; justify-content: space-between; margin: 5px 0 21px; }</code> | Align board heading/count horizontally and space it from filters. |
| [34](/C:/AI_employee/playground/static/styles.css:34) | <code>.count { font-size: 11px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 20px; color: var(--muted); }</code> | Style the task count as a muted small outlined pill. |
| [35](/C:/AI_employee/playground/static/styles.css:35) | <code>.filters { display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--line); padding-bottom: 15px; margin-bottom: 5px; }</code> | Lay out filter buttons with wrapping, gaps and a bottom divider. |
| [36](/C:/AI_employee/playground/static/styles.css:36) | <code>.filters button { border: 0; background: transparent; color: var(--muted); font-size: 12px; border-radius: 6px; padding: 9px 13px; }</code> | Style unselected filters as small muted buttons with transparent background and rounded corners. |
| [37](/C:/AI_employee/playground/static/styles.css:37) | <code>.filters button[aria-pressed='true'] { color: white; background: var(--ink); }</code> | Style only aria-pressed=true as dark background with white text. |
| [38](/C:/AI_employee/playground/static/styles.css:38) | <code>#notice { font-size: 12px; color: var(--green); min-height: 18px; margin: 10px 0; }</code> | Reserve notice height to reduce layout jumps and use success green text. |
| [39](/C:/AI_employee/playground/static/styles.css:39) | <code>#notice.error { color: #a33330; }</code> | Use red notice text when JavaScript assigns error class. |
| [40](/C:/AI_employee/playground/static/styles.css:40) | <code>.task-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 15px; }</code> | Use two equal flexible task-card columns with 15px gap. minmax(0,1fr) lets columns shrink within available width. |
| [41](/C:/AI_employee/playground/static/styles.css:41) | <code>.task-card { min-width: 0; background: #fffefa; border: 1px solid var(--line); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }</code> | Style each card with background/border/corners/padding; min-width=0 permits text wrapping; vertical flex permits actions at its bottom. |
| [42](/C:/AI_employee/playground/static/styles.css:42) | <code>.card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }</code> | Align status badge and ID at opposite sides of the card top. |
| [43](/C:/AI_employee/playground/static/styles.css:43) | <code>.status-badge { font-size: 10px; font-weight: 600; border-radius: 4px; padding: 5px 7px; }</code> | Style badge typography, corner radius and padding. |
| [44](/C:/AI_employee/playground/static/styles.css:44) | <code>.status-badge.todo { color: #806035; background: #f5eedc; }</code> | Use warm colors for todo badges. |
| [45](/C:/AI_employee/playground/static/styles.css:45) | <code>.status-badge.in_progress { color: #416a89; background: #e6eef5; }</code> | Use blue colors for in_progress badges. |
| [46](/C:/AI_employee/playground/static/styles.css:46) | <code>.status-badge.done { color: #3d7956; background: #e5f0e6; }</code> | Use green colors for done badges. |
| [47](/C:/AI_employee/playground/static/styles.css:47) | <code>.task-id { color: #9ba59d; font-size: 10px; font-family: Consolas, monospace; }</code> | Style task ID as small muted monospace text. |
| [48](/C:/AI_employee/playground/static/styles.css:48) | <code>h3 { font-size: 16px; line-height: 1.45; font-weight: 600; margin: 17px 0 8px; overflow-wrap: anywhere; }</code> | Style task heading; overflow-wrap:anywhere prevents a long unbroken title widening its card. |
| [49](/C:/AI_employee/playground/static/styles.css:49) | <code>.task-description { color: var(--muted); font-size: 12px; line-height: 1.65; margin: 0 0 22px; overflow-wrap: anywhere; white-space: pre-wrap; }</code> | Style description; overflow-wrap prevents long words overflowing and pre-wrap preserves user newlines/spaces while allowing wraps. |
| [50](/C:/AI_employee/playground/static/styles.css:50) | <code>.task-actions { display: flex; flex-wrap: wrap; gap: 9px; padding-top: 14px; border-top: 1px solid #edf0e8; margin-top: auto; }</code> | Clean action layout: flex items wrap when needed, have 9px gaps, top spacing/divider, and margin-top:auto pushes them to the bottom of a flex card. |
| [51](/C:/AI_employee/playground/static/styles.css:51) | <code>.task-actions button { min-height: 34px; border-radius: 5px; padding: 7px 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }</code> | Give action buttons a minimum 34px height, padding/border radius/small bold text; nowrap keeps each action label on one line. |
| [52](/C:/AI_employee/playground/static/styles.css:52) | <code>.advance { color: var(--green); background: #edf3ed; border: 1px solid #d7e3d6; }</code> | Style the advance action with green tint and border. |
| [53](/C:/AI_employee/playground/static/styles.css:53) | <code>.remove { color: #82746d; background: transparent; border: 1px solid #e6e0d8; }</code> | Style the remove action with neutral color/outlined transparent background. |
| [54](/C:/AI_employee/playground/static/styles.css:54) | <code>.advance:hover { background: #dfeadf; }</code> | Darken the advance tint on hover. |
| [55](/C:/AI_employee/playground/static/styles.css:55) | <code>.remove:hover { background: #f8e9e3; color: #963e2e; }</code> | Give remove a warm hover background/redder text. |
| [56](/C:/AI_employee/playground/static/styles.css:56) | <code>.empty { padding: 32px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; }</code> | Style the empty-result panel with centered muted text, padding and dashed outline. |
| [57](/C:/AI_employee/playground/static/styles.css:57) | <code>footer { display: flex; justify-content: space-between; color: #859287; font-size: 10px; border-top: 1px solid var(--line); margin-top: 42px; padding-top: 18px; }</code> | Style footer as two spaced items with muted small text and a top divider. |
| [58](/C:/AI_employee/playground/static/styles.css:58) | <code>@media (max-width: 900px) { .workspace { grid-template-columns: 250px minmax(0,1fr); gap: 22px; } .task-list { grid-template-columns: 1fr; } }</code> | At widths up to 900px shrink sidebar/gap and switch task grid to one column. |
| [59](/C:/AI_employee/playground/static/styles.css:59) | <code>@media (max-width: 640px) { .topbar { padding: 19px 20px; } .workspace-label { max-width: 90px; text-align: right; font-size: 8px; line-height: 1.8; } main { padding: 28px 20px; } .workspace { grid-template-columns: 1fr; gap: 28px; } .create-panel { padding: 20px; } .intro { margin-bottom: 25px; } .subtitle { font-size: 13px; } .task-card { padding: 20px; } footer { gap: 15px; line-height: 1.6; } }</code> | At widths up to 640px shrink page/topbar padding, wrap the small header label, stack form above board, adjust text/gaps and keep footer readable. The clean actions still use flexible wrapping. |

### tools/Start-Playground.ps1

[Open actual file](/C:/AI_employee/tools/Start-Playground.ps1) · 40 lines · snapshot SHA256: 681a3b571e3b688e3d60c3d847c6fe1c148fdc57453c7b407d8fec0954892bb3

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/tools/Start-Playground.ps1:1) | <code>param([ValidateSet('clean','frontend','backend','feature')][string]$Scenario='clean',[int]$Port=8080,[switch]$ResetData,[switch]$Build,[ValidateRange(0,3600)][int]$RunForSeconds=0)</code> | Declare scenario enum, port, ResetData/Build switches and optional bounded run duration. Scenario defaults clean; RunForSeconds=0 serves until stopped, otherwise at most 3600 seconds is accepted. |
| [2](/C:/AI_employee/tools/Start-Playground.ps1:2) | <code>$ErrorActionPreference='Stop'</code> | Terminate on PowerShell errors. |
| [3](/C:/AI_employee/tools/Start-Playground.ps1:3) | <code>if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }</code> | Validate the local port range. |
| [4](/C:/AI_employee/tools/Start-Playground.ps1:4) | <code>$root=Split-Path $PSScriptRoot</code> | Derive workspace root from this script's directory. |
| [5](/C:/AI_employee/tools/Start-Playground.ps1:5) | <code>$source=if ($Scenario -eq 'clean') { Join-Path $root 'playground' } else { Join-Path $root "var\fixtures\$Scenario" }</code> | Choose playground for clean, or var/fixtures/&lt;scenario&gt; for the other sources. This selection of different checkouts creates different behavior; the C++ scenario flag itself does not. |
| [6](/C:/AI_employee/tools/Start-Playground.ps1:6) | <code>if (-not (Test-Path -LiteralPath (Join-Path $source 'src\main.cpp'))) { throw 'Fixture source missing. Run tools\Initialize-Fixtures.ps1 first.' }</code> | Require an existing fixture source file; tell the user to initialize fixtures if absent. |
| [7](/C:/AI_employee/tools/Start-Playground.ps1:7) | <code>$executable=Join-Path $source 'build\team-tasks.exe'</code> | Choose that source worktree's compiled executable. |
| [8](/C:/AI_employee/tools/Start-Playground.ps1:8) | <code>if ($Build -or -not (Test-Path -LiteralPath $executable)) { &amp; (Join-Path $PSScriptRoot 'Build-Playground.ps1') -Source $source }</code> | Build if explicitly requested or executable missing. Otherwise reuse the existing build, so a source edit needs -Build or an explicit Build-Playground invocation. |
| [9](/C:/AI_employee/tools/Start-Playground.ps1:9) | <code>$dataDirectory=Join-Path $root 'var\data'</code> | Choose shared parent var/data for manual scenario databases. |
| [10](/C:/AI_employee/tools/Start-Playground.ps1:10) | <code>New-Item -ItemType Directory -Force -Path $dataDirectory &#124; Out-Null</code> | Create the directory if absent. |
| [11](/C:/AI_employee/tools/Start-Playground.ps1:11) | <code>$database=Join-Path $dataDirectory "$Scenario.db"</code> | Choose a separate database filename for this scenario, e.g. backend.db. |
| [12](/C:/AI_employee/tools/Start-Playground.ps1:12) | <code># Refuse reset while this scenario's server is running. Data reset never edits source.</code> | Comment: running-server detection prevents the launcher resetting its live scenario data. |
| [13](/C:/AI_employee/tools/Start-Playground.ps1:13) | <code>$running=Get-CimInstance Win32_Process -Filter "Name='team-tasks.exe'" &#124; Where-Object { $_.ExecutablePath -eq $executable }</code> | Query Windows processes and select a running team-tasks.exe at this exact executable path. This WMI/CIM read can be denied inside the agent sandbox; normal machine access was verified separately. |
| [14](/C:/AI_employee/tools/Start-Playground.ps1:14) | <code>if ($running) { throw 'This scenario is already running. Stop its server with Ctrl+C before starting or resetting it.' }</code> | Reject another instance of this scenario before seeding or serving; stop its existing server first. |
| [15](/C:/AI_employee/tools/Start-Playground.ps1:15) | <code>if ($ResetData -or -not (Test-Path -LiteralPath $database)) {</code> | Seed when explicitly requested or when this scenario's database is new. |
| [16](/C:/AI_employee/tools/Start-Playground.ps1:16) | <code>    &amp; $executable --db $database --seed</code> | Invoke the executable in seed-only mode on this database. ResetData changes task rows, not source files or fixture branches. |
| [17](/C:/AI_employee/tools/Start-Playground.ps1:17) | <code>    if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed reset failed.' }</code> | Fail if seeding returned a nonzero exit code. |
| [18](/C:/AI_employee/tools/Start-Playground.ps1:18) | <code>}</code> | Close seed branch. |
| [19](/C:/AI_employee/tools/Start-Playground.ps1:19) | <code>Write-Host "Scenario: $Scenario. Reset controls are local CLI only. Ctrl+C stops the server."</code> | Print the chosen scenario and local-control reminder. |
| [20](/C:/AI_employee/tools/Start-Playground.ps1:20) | <code>Write-Host "Open http://127.0.0.1:$Port"</code> | Print its browser URL. |
| [21](/C:/AI_employee/tools/Start-Playground.ps1:21) | <code>$previewProcess=New-Object System.Diagnostics.Process</code> | Create a .NET Process object whose lifetime the launcher owns. |
| [22](/C:/AI_employee/tools/Start-Playground.ps1:22) | <code>$previewProcess.StartInfo.FileName=$executable</code> | Set the exact executable path. |
| [23](/C:/AI_employee/tools/Start-Playground.ps1:23) | <code>$previewProcess.StartInfo.Arguments='--db "' + $database + '" --static "' + (Join-Path $source 'build\static') + '" --port ' + $Port + ' --scenario ' + $Scenario</code> | Pass quoted database and build/static paths plus port and scenario label. Arguments are controlled developer values; no model command arguments exist in Phase 1. |
| [24](/C:/AI_employee/tools/Start-Playground.ps1:24) | <code>$previewProcess.StartInfo.UseShellExecute=$false</code> | Launch directly rather than through a shell executable association. |
| [25](/C:/AI_employee/tools/Start-Playground.ps1:25) | <code>$previewProcess.StartInfo.CreateNoWindow=$true</code> | Prevent a separate visible process window. |
| [26](/C:/AI_employee/tools/Start-Playground.ps1:26) | <code>try {</code> | Begin a try/finally lifetime boundary so cleanup runs when this script leaves its serve loop normally or unwinds. |
| [27](/C:/AI_employee/tools/Start-Playground.ps1:27) | <code>    if (-not $previewProcess.Start()) { throw 'Could not start the playground.' }</code> | Start the child; fail if .NET reported failure. |
| [28](/C:/AI_employee/tools/Start-Playground.ps1:28) | <code>    $previewClock=[System.Diagnostics.Stopwatch]::StartNew()</code> | Start an elapsed-time clock for optional timed runs. |
| [29](/C:/AI_employee/tools/Start-Playground.ps1:29) | <code>    while (-not $previewProcess.HasExited) {</code> | Keep serving while the child is alive. |
| [30](/C:/AI_employee/tools/Start-Playground.ps1:30) | <code>        if ($RunForSeconds -gt 0 -and $previewClock.Elapsed.TotalSeconds -ge $RunForSeconds) { break }</code> | Leave the loop if the configured nonzero time limit elapsed; zero means no launcher time cap. |
| [31](/C:/AI_employee/tools/Start-Playground.ps1:31) | <code>        Start-Sleep -Milliseconds 250</code> | Sleep for 250 milliseconds between lifecycle polls, keeping the script responsive to interruption. |
| [32](/C:/AI_employee/tools/Start-Playground.ps1:32) | <code>    }</code> | Close the serve loop. |
| [33](/C:/AI_employee/tools/Start-Playground.ps1:33) | <code>    if ($previewProcess.HasExited -and $previewProcess.ExitCode -ne 0) { throw 'Playground server exited with an error.' }</code> | If the child already exited with failure, throw an error rather than presenting a working server. |
| [34](/C:/AI_employee/tools/Start-Playground.ps1:34) | <code>} finally {</code> | Enter cleanup regardless of normal completion or an exception. |
| [35](/C:/AI_employee/tools/Start-Playground.ps1:35) | <code>    if (-not $previewProcess.HasExited) {</code> | Check whether the owned process is still alive. |
| [36](/C:/AI_employee/tools/Start-Playground.ps1:36) | <code>        $previewProcess.Kill()</code> | Kill that specific owned process, not all similarly named apps. This ends the preview; the database remains on disk. |
| [37](/C:/AI_employee/tools/Start-Playground.ps1:37) | <code>        $previewProcess.WaitForExit(3000) &#124; Out-Null</code> | Wait up to three seconds for its exit; suppress the boolean result. |
| [38](/C:/AI_employee/tools/Start-Playground.ps1:38) | <code>    }</code> | Close live-process cleanup branch. |
| [39](/C:/AI_employee/tools/Start-Playground.ps1:39) | <code>    $previewProcess.Dispose()</code> | Dispose the process handle. |
| [40](/C:/AI_employee/tools/Start-Playground.ps1:40) | <code>}</code> | Close finally. Timed cleanup was checked; revised Ctrl+C behavior is still a manual walkthrough check. |

### tools/Build-Playground.ps1

[Open actual file](/C:/AI_employee/tools/Build-Playground.ps1) · 33 lines · snapshot SHA256: 400fe9b9a2ccaf2668aa24ab9fd981e22833360acaadc9a7e19f22b3e4ccacd9

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/tools/Build-Playground.ps1:1) | <code>param([string]$Source = (Join-Path (Split-Path $PSScriptRoot) 'playground'))</code> | Accept a source directory, defaulting to playground beside tools. Pass a different Source to compile a fixture or your own worktree. |
| [2](/C:/AI_employee/tools/Build-Playground.ps1:2) | <code>$ErrorActionPreference = 'Stop'</code> | Make PowerShell errors terminate this build script. |
| [3](/C:/AI_employee/tools/Build-Playground.ps1:3) | <code>$Source = (Resolve-Path -LiteralPath $Source).Path</code> | Resolve the source directory to its existing absolute path. |
| [4](/C:/AI_employee/tools/Build-Playground.ps1:4) | <code>$outputDirectory = Join-Path $Source 'build'</code> | Choose the ignored build subdirectory for generated outputs. |
| [5](/C:/AI_employee/tools/Build-Playground.ps1:5) | <code>New-Item -ItemType Directory -Force -Path $outputDirectory &#124; Out-Null</code> | Create that directory if needed; suppress directory-object output. |
| [6](/C:/AI_employee/tools/Build-Playground.ps1:6) | <code>$compiler = 'C:\msys64\ucrt64\bin\g++.exe'</code> | Select the observed MSYS2 UCRT64 compiler path explicitly. |
| [7](/C:/AI_employee/tools/Build-Playground.ps1:7) | <code>if (-not (Test-Path -LiteralPath $compiler)) { throw 'MSYS2 UCRT64 g++ was not found.' }</code> | Fail clearly if that compiler is missing. |
| [8](/C:/AI_employee/tools/Build-Playground.ps1:8) | <code>$commit = &amp; git -c "safe.directory=$Source" -C $Source rev-parse HEAD 2&gt;$null</code> | Read HEAD from this specific source repository. safe.directory is scoped to this Git invocation, not a global Git setting; stderr is suppressed. |
| [9](/C:/AI_employee/tools/Build-Playground.ps1:9) | <code>if ($LASTEXITCODE -ne 0) { throw 'Initialize and commit the playground repository before building.' }</code> | Reject an uninitialized/uncommitted repository because a commit identity is required. Some native-command errors can terminate earlier under ErrorActionPreference. |
| [10](/C:/AI_employee/tools/Build-Playground.ps1:10) | <code>$sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $Source 'src'),(Join-Path $Source 'static'),(Join-Path $Source 'third_party') -File -Recurse &#124; Sort-Object FullName)</code> | Enumerate files in src, static and third_party, recursively and in stable path order. build and database files are excluded. |
| [11](/C:/AI_employee/tools/Build-Playground.ps1:11) | <code>$digestText = ($sourceFiles &#124; ForEach-Object { $_.FullName.Substring($Source.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join "`n"</code> | For each selected file combine its source-relative path and SHA256 bytes hash, joining records with newlines. This captures uncommitted source contents too. |
| [12](/C:/AI_employee/tools/Build-Playground.ps1:12) | <code>$hasher = [System.Security.Cryptography.SHA256]::Create()</code> | Create a SHA256 hasher for the aggregate identity string. |
| [13](/C:/AI_employee/tools/Build-Playground.ps1:13) | <code>try { $digest = ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($digestText)))).Replace('-','').ToLowerInvariant() }</code> | Hash the UTF-8 identity string and convert the resulting bytes to lowercase hexadecimal without hyphens. |
| [14](/C:/AI_employee/tools/Build-Playground.ps1:14) | <code>finally { $hasher.Dispose() }</code> | Dispose the .NET hashing resource in finally. |
| [15](/C:/AI_employee/tools/Build-Playground.ps1:15) | <code># Generated header avoids Windows PowerShell native-argument quote stripping.</code> | Comment explaining why build identity is generated as a header instead of quoted compiler -D arguments. |
| [16](/C:/AI_employee/tools/Build-Playground.ps1:16) | <code>$identity = '#define PLAYGROUND_COMMIT "' + $commit + '"' + "`n" + '#define PLAYGROUND_BUILD "' + $digest + '"' + "`n"</code> | Build two preprocessor definitions containing the current commit and aggregate digest, with real newline characters between them. |
| [17](/C:/AI_employee/tools/Build-Playground.ps1:17) | <code>[IO.File]::WriteAllText((Join-Path $outputDirectory 'build_identity.hpp'),$identity)</code> | Write build_identity.hpp. Do not edit it manually; rebuilding overwrites it. |
| [18](/C:/AI_employee/tools/Build-Playground.ps1:18) | <code># One translation unit avoids parsing the large HTTP/JSON headers twice.</code> | Comment explaining the unity build optimization. |
| [19](/C:/AI_employee/tools/Build-Playground.ps1:19) | <code>$unity = (@('main.cpp','routes.cpp','task_repository.cpp') &#124; ForEach-Object { '#include "' + (Join-Path $Source "src\$_").Replace('\','/') + '"' }) -join "`n"</code> | Generate include lines for main.cpp, routes.cpp and task_repository.cpp using absolute forward-slash paths. They become one translation unit, avoiding repeat parsing of large headers. |
| [20](/C:/AI_employee/tools/Build-Playground.ps1:20) | <code>[IO.File]::WriteAllText((Join-Path $outputDirectory 'unity.cpp'),$unity)</code> | Write that generated unity.cpp file under build/. |
| [21](/C:/AI_employee/tools/Build-Playground.ps1:21) | <code>$arguments = @('-std=c++20','-O0','-g','-Wall','-Wextra','-Wpedantic','-pthread','-static-libgcc','-static-libstdc++', '-I' + (Join-Path $Source 'third_party'), '-I' + $outputDirectory, '-IC:\msys64\ucrt64\include', (Join-Path $outputDirectory 'unity.cpp'), '-LC:\msys64\ucrt64\lib','-lsqlite3','-lws2_32','-lcrypt32','-o',(Join-Path $outputDirectory 'team-tasks.exe'))</code> | Construct compiler arguments: C++20, no optimization, debug symbols, warnings, pthread support, static GCC/C++ runtime, include directories, unity.cpp, SQLite/Windows socket/crypto linking and output exe. -I searches headers, -L searches link libraries, -l names a library, -o chooses output. |
| [22](/C:/AI_employee/tools/Build-Playground.ps1:22) | <code>&amp; $compiler @arguments</code> | Invoke the selected compiler with the argument array; this is local developer execution, not a restricted worker runner. |
| [23](/C:/AI_employee/tools/Build-Playground.ps1:23) | <code>if ($LASTEXITCODE -ne 0) { throw 'C++ compilation failed.' }</code> | Fail if the compiler/linker returned a nonzero exit code. A running Windows exe can prevent overwriting that output file. |
| [24](/C:/AI_employee/tools/Build-Playground.ps1:24) | <code>foreach ($dll in @('libsqlite3-0.dll','libwinpthread-1.dll')) {</code> | Iterate over the two required dynamic libraries: SQLite and Windows pthread runtime. |
| [25](/C:/AI_employee/tools/Build-Playground.ps1:25) | <code>    Copy-Item -LiteralPath (Join-Path 'C:\msys64\ucrt64\bin' $dll) -Destination $outputDirectory -Force</code> | Copy the installed matching DLL into build beside the executable, replacing an older copy. |
| [26](/C:/AI_employee/tools/Build-Playground.ps1:26) | <code>}</code> | Close DLL-copy iteration. |
| [27](/C:/AI_employee/tools/Build-Playground.ps1:27) | <code>$staticOutput = Join-Path $outputDirectory 'static'</code> | Choose build/static for the snapshot served by the app. |
| [28](/C:/AI_employee/tools/Build-Playground.ps1:28) | <code>New-Item -ItemType Directory -Force -Path $staticOutput &#124; Out-Null</code> | Create that snapshot directory if missing. |
| [29](/C:/AI_employee/tools/Build-Playground.ps1:29) | <code>foreach ($asset in @('index.html','app.js','styles.css')) {</code> | Iterate over exactly the three frontend assets; adding a new asset later also requires updating this list. |
| [30](/C:/AI_employee/tools/Build-Playground.ps1:30) | <code>    Copy-Item -LiteralPath (Join-Path $Source "static\$asset") -Destination $staticOutput -Force</code> | Copy each asset from editable static source into the served build snapshot. |
| [31](/C:/AI_employee/tools/Build-Playground.ps1:31) | <code>}</code> | Close asset-copy iteration. |
| [32](/C:/AI_employee/tools/Build-Playground.ps1:32) | <code>[ordered]@{ commit=$commit; build=$digest; compiler=(&amp; $compiler -dumpfullversion); built_at=[DateTime]::UtcNow.ToString('o') } &#124; ConvertTo-Json &#124; Set-Content -LiteralPath (Join-Path $outputDirectory 'build-info.json') -Encoding UTF8</code> | Serialize ordered build metadata (commit, digest, compiler version and UTC build time) as UTF-8 JSON in build-info.json. |
| [33](/C:/AI_employee/tools/Build-Playground.ps1:33) | <code>Write-Host "Built $outputDirectory\team-tasks.exe"</code> | Print the executable's generated path on successful completion. |

### tools/Initialize-Fixtures.ps1

[Open actual file](/C:/AI_employee/tools/Initialize-Fixtures.ps1) · 38 lines · snapshot SHA256: 779fca1a6c4ec73fa789202423a3eef4a8d2c9f17a89178faf718fa4cc570954

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/tools/Initialize-Fixtures.ps1:1) | <code># Developer-only source fixture creation. This script is not a worker repair tool.</code> | Comment establishes developer fixture setup, not a worker repair tool. |
| [2](/C:/AI_employee/tools/Initialize-Fixtures.ps1:2) | <code>$ErrorActionPreference='Stop'</code> | Terminate on setup errors. |
| [3](/C:/AI_employee/tools/Initialize-Fixtures.ps1:3) | <code>$root=Split-Path $PSScriptRoot</code> | Derive workspace root. |
| [4](/C:/AI_employee/tools/Initialize-Fixtures.ps1:4) | <code>$repository=Join-Path $root 'playground'</code> | Select the separate playground Git repository. |
| [5](/C:/AI_employee/tools/Initialize-Fixtures.ps1:5) | <code>$fixtureRoot=Join-Path $root 'var\fixtures'</code> | Select the parent directory for fixture worktrees. |
| [6](/C:/AI_employee/tools/Initialize-Fixtures.ps1:6) | <code>New-Item -ItemType Directory -Force -Path $fixtureRoot &#124; Out-Null</code> | Create that directory if absent. |
| [7](/C:/AI_employee/tools/Initialize-Fixtures.ps1:7) | <code>&amp; git -c "safe.directory=$repository" -C $repository rev-parse 'phase1-clean^{commit}' *&gt; $null</code> | Require phase1-clean to resolve to a commit. Scope repository trust to this Git command and suppress command output. |
| [8](/C:/AI_employee/tools/Initialize-Fixtures.ps1:8) | <code>if ($LASTEXITCODE -ne 0) { throw 'The phase1-clean tag is required.' }</code> | Fail if the clean tag is absent. |
| [9](/C:/AI_employee/tools/Initialize-Fixtures.ps1:9) | <code>$utf8=New-Object System.Text.UTF8Encoding($false)</code> | Create a UTF-8 encoder without a BOM for source rewrites. |
| [10](/C:/AI_employee/tools/Initialize-Fixtures.ps1:10) | <code>foreach ($scenario in @('frontend','backend','feature')) {</code> | Iterate over frontend, backend and feature source scenarios. |
| [11](/C:/AI_employee/tools/Initialize-Fixtures.ps1:11) | <code>    $checkout=Join-Path $fixtureRoot $scenario</code> | Choose this scenario's worktree path. |
| [12](/C:/AI_employee/tools/Initialize-Fixtures.ps1:12) | <code>    if (Test-Path -LiteralPath $checkout) {</code> | Check whether the directory already exists. |
| [13](/C:/AI_employee/tools/Initialize-Fixtures.ps1:13) | <code>        Write-Host "Preserving existing $scenario fixture. No source reset performed."</code> | Report that existing source is being preserved; this is not a reset or integrity verification of that directory. |
| [14](/C:/AI_employee/tools/Initialize-Fixtures.ps1:14) | <code>        continue</code> | Skip creation/source mutation for an existing fixture, preserving user work. |
| [15](/C:/AI_employee/tools/Initialize-Fixtures.ps1:15) | <code>    }</code> | Close existing-directory branch. |
| [16](/C:/AI_employee/tools/Initialize-Fixtures.ps1:16) | <code>    &amp; git -c "safe.directory=$repository" -C $repository worktree add -b "fixture/$scenario" $checkout phase1-clean</code> | Create a new branch fixture/&lt;scenario&gt; and a linked worktree at the clean tag. Worktrees share Git objects/history but have separate files, branches and indexes. |
| [17](/C:/AI_employee/tools/Initialize-Fixtures.ps1:17) | <code>    if ($LASTEXITCODE -ne 0) { throw "Could not create $scenario fixture; reconcile existing branches rather than deleting them." }</code> | Fail if Git could not create it, e.g. because a branch already exists. Do not automatically delete another branch/worktree. |
| [18](/C:/AI_employee/tools/Initialize-Fixtures.ps1:18) | <code>    if ($scenario -eq 'frontend') {</code> | For frontend only, begin the layout-defect introduction. |
| [19](/C:/AI_employee/tools/Initialize-Fixtures.ps1:19) | <code>        $path=Join-Path $checkout 'static\styles.css'</code> | Locate that fixture's editable CSS source. |
| [20](/C:/AI_employee/tools/Initialize-Fixtures.ps1:20) | <code>        $css=[IO.File]::ReadAllText($path)</code> | Read its clean CSS text. |
| [21](/C:/AI_employee/tools/Initialize-Fixtures.ps1:21) | <code>        $css += "`n/* Developer-seeded mobile action overlap fixture. */`n@media (max-width: 640px) { .task-actions { position: relative; min-height: 50px; } .task-actions button { width: 145px; } .task-actions .remove { position: absolute; left: 105px; top: 14px; } }`n"</code> | Append a mobile-only rule: action container becomes relative, each button is 145px wide, and Remove is absolutely placed 105px from its left. The 40px intersection is a real CSS source defect. |
| [22](/C:/AI_employee/tools/Initialize-Fixtures.ps1:22) | <code>        [IO.File]::WriteAllText($path,$css,$utf8)</code> | Write the changed source without BOM. |
| [23](/C:/AI_employee/tools/Initialize-Fixtures.ps1:23) | <code>    } elseif ($scenario -eq 'backend') {</code> | For backend instead, begin the query-defect introduction. |
| [24](/C:/AI_employee/tools/Initialize-Fixtures.ps1:24) | <code>        $path=Join-Path $checkout 'src\task_repository.cpp'</code> | Locate that fixture's repository implementation source. |
| [25](/C:/AI_employee/tools/Initialize-Fixtures.ps1:25) | <code>        $code=[IO.File]::ReadAllText($path)</code> | Read it as text. |
| [26](/C:/AI_employee/tools/Initialize-Fixtures.ps1:26) | <code>        $original="WHERE (?1 = '' OR status = ?1) ORDER BY id;"</code> | Store the expected original clean WHERE clause as a setup-match anchor. |
| [27](/C:/AI_employee/tools/Initialize-Fixtures.ps1:27) | <code>        if (-not $code.Contains($original)) { throw 'Expected query was not found; fixture initialization requires review.' }</code> | Require that known setup anchor before editing, so unrelated source does not get silently rewritten. |
| [28](/C:/AI_employee/tools/Initialize-Fixtures.ps1:28) | <code>        $code=$code.Replace($original,"WHERE (?1 = '' OR status = ?1 OR ?1 = 'todo') ORDER BY id;")</code> | Introduce OR ?1 = 'todo' in the WHERE clause. This script creates the defect; it contains no worker tool for repairing it and is never exposed to the model. |
| [29](/C:/AI_employee/tools/Initialize-Fixtures.ps1:29) | <code>        [IO.File]::WriteAllText($path,$code,$utf8)</code> | Write the changed backend source. |
| [30](/C:/AI_employee/tools/Initialize-Fixtures.ps1:30) | <code>    }</code> | Close scenario-specific source mutation. Feature stays at the clean commit because its missing UI filter already defines the feature baseline. |
| [31](/C:/AI_employee/tools/Initialize-Fixtures.ps1:31) | <code>    if ($scenario -ne 'feature') {</code> | Only frontend/backend require a new source commit. |
| [32](/C:/AI_employee/tools/Initialize-Fixtures.ps1:32) | <code>        &amp; git -c "safe.directory=$checkout" -C $checkout add -- static/styles.css src/task_repository.cpp</code> | Stage the two permitted fixture source paths; only the changed one contributes to that commit. |
| [33](/C:/AI_employee/tools/Initialize-Fixtures.ps1:33) | <code>        if ($LASTEXITCODE -ne 0) { throw 'Fixture staging failed.' }</code> | Fail if staging failed. |
| [34](/C:/AI_employee/tools/Initialize-Fixtures.ps1:34) | <code>        &amp; git -c "safe.directory=$checkout" -C $checkout -c commit.gpgsign=false -c user.name='DevDesk Demo' -c user.email='devdesk@example.invalid' commit -m "Seed $scenario defect for manual reproduction"</code> | Commit the introduced defect with a fictional local identity and signing disabled for this invocation only. No global Git setting or remote publication occurs. |
| [35](/C:/AI_employee/tools/Initialize-Fixtures.ps1:35) | <code>        if ($LASTEXITCODE -ne 0) { throw 'Fixture commit failed.' }</code> | Fail if commit creation failed. |
| [36](/C:/AI_employee/tools/Initialize-Fixtures.ps1:36) | <code>    }</code> | Close commit branch. |
| [37](/C:/AI_employee/tools/Initialize-Fixtures.ps1:37) | <code>    Write-Host "Created independent $scenario source fixture."</code> | Report that the scenario's independent source baseline was created. |
| [38](/C:/AI_employee/tools/Initialize-Fixtures.ps1:38) | <code>}</code> | Close scenario iteration. |

### trusted_checks/phase1.mjs

[Open actual file](/C:/AI_employee/trusted_checks/phase1.mjs) · 221 lines · snapshot SHA256: f7516081e19f0e70157abbd7401d73fed0d1dce76dd6abd25870b05a76473030

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/trusted_checks/phase1.mjs:1) | <code>// Trusted developer checks. Never mount this file writable in a repair task.</code> | State that the evaluator belongs outside a writable repair checkout. |
| [2](/C:/AI_employee/trusted_checks/phase1.mjs:2) | <code>// No model stubs or repair code: observations come from actual API/browser execution.</code> | State that observations are real API/browser execution, with no model stub or repair script. |
| [3](/C:/AI_employee/trusted_checks/phase1.mjs:3) | <code>import { chromium } from '../tools/node_modules/playwright/index.mjs';</code> | Import Playwright's Chromium driver from the tools-local installation; actual browser selection below uses installed Chrome. |
| [4](/C:/AI_employee/trusted_checks/phase1.mjs:4) | <code>import { spawn, execFileSync } from 'node:child_process';</code> | Import asynchronous process spawning and bounded synchronous executable calls. |
| [5](/C:/AI_employee/trusted_checks/phase1.mjs:5) | <code>import { once } from 'node:events';</code> | Import a helper that resolves when an event occurs. |
| [6](/C:/AI_employee/trusted_checks/phase1.mjs:6) | <code>import { createServer } from 'node:net';</code> | Import TCP server creation to obtain an available loopback port. |
| [7](/C:/AI_employee/trusted_checks/phase1.mjs:7) | <code>import { mkdir, writeFile, readFile } from 'node:fs/promises';</code> | Import async filesystem directory/write/read helpers for evidence. |
| [8](/C:/AI_employee/trusted_checks/phase1.mjs:8) | <code>import { existsSync } from 'node:fs';</code> | Import a synchronous existence check for build prerequisites. |
| [9](/C:/AI_employee/trusted_checks/phase1.mjs:9) | <code>import { resolve, join, dirname } from 'node:path';</code> | Import platform-aware path helpers. |
| [10](/C:/AI_employee/trusted_checks/phase1.mjs:10) | <code>import { fileURLToPath } from 'node:url';</code> | Convert this ES module's URL into a filesystem path. |
| [11](/C:/AI_employee/trusted_checks/phase1.mjs:11) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [12](/C:/AI_employee/trusted_checks/phase1.mjs:12) | <code>const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');</code> | Resolve the workspace root relative to the evaluator file, independent of the caller's current directory. |
| [13](/C:/AI_employee/trusted_checks/phase1.mjs:13) | <code>const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;</code> | Build a run ID from UTC time plus process ID, replacing Windows-invalid colons and simplifying punctuation. |
| [14](/C:/AI_employee/trusted_checks/phase1.mjs:14) | <code>const output = join(root, 'var', 'evidence', runId);</code> | Create a unique evidence path for this run. |
| [15](/C:/AI_employee/trusted_checks/phase1.mjs:15) | <code>await mkdir(output, { recursive: true });</code> | Ensure that directory exists. |
| [16](/C:/AI_employee/trusted_checks/phase1.mjs:16) | <code>const report = { run_id: runId, started_at: new Date().toISOString(), live_model_calls: 0, scope: 'Phase 1 developer-authored app only; no autonomous repair or sandbox claim', scenarios: [] };</code> | Initialize the report with UTC start, zero model calls, scope disclosure and empty scenario list. |
| [17](/C:/AI_employee/trusted_checks/phase1.mjs:17) | <code>let activeServer;</code> | Reserve a handle to the currently owned server for failure cleanup. |
| [18](/C:/AI_employee/trusted_checks/phase1.mjs:18) | <code>let browser;</code> | Reserve the browser handle for final cleanup. |
| [19](/C:/AI_employee/trusted_checks/phase1.mjs:19) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [20](/C:/AI_employee/trusted_checks/phase1.mjs:20) | <code>function record(scenario, name, condition, observation, evidence = null) {</code> | Define assertion recording with optional evidence reference. |
| [21](/C:/AI_employee/trusted_checks/phase1.mjs:21) | <code>  scenario.assertions.push({ name, status: condition ? 'PASS' : 'FAIL', observation, evidence });</code> | Append PASS or FAIL according to the observed condition, preserving the observation even when it fails. |
| [22](/C:/AI_employee/trusted_checks/phase1.mjs:22) | <code>}</code> | Close record. |
| [23](/C:/AI_employee/trusted_checks/phase1.mjs:23) | <code>async function unusedPort() {</code> | Define a helper finding an available port. |
| [24](/C:/AI_employee/trusted_checks/phase1.mjs:24) | <code>  const socket = createServer();</code> | Create a temporary TCP server socket. |
| [25](/C:/AI_employee/trusted_checks/phase1.mjs:25) | <code>  socket.listen(0, '127.0.0.1');</code> | Bind loopback with port 0, letting Windows select an available ephemeral port. |
| [26](/C:/AI_employee/trusted_checks/phase1.mjs:26) | <code>  await once(socket, 'listening');</code> | Wait until binding completes. |
| [27](/C:/AI_employee/trusted_checks/phase1.mjs:27) | <code>  const port = socket.address().port;</code> | Read the assigned port. |
| [28](/C:/AI_employee/trusted_checks/phase1.mjs:28) | <code>  await new Promise(resolve =&gt; socket.close(resolve));</code> | Close the temporary reservation and wait for closure. A small allocation race before the app binds remains possible. |
| [29](/C:/AI_employee/trusted_checks/phase1.mjs:29) | <code>  return port;</code> | Return that port. |
| [30](/C:/AI_employee/trusted_checks/phase1.mjs:30) | <code>}</code> | Close unusedPort. |
| [31](/C:/AI_employee/trusted_checks/phase1.mjs:31) | <code>async function launch(source, db, scenarioName) {</code> | Define launch for a source checkout, independent database and display label. |
| [32](/C:/AI_employee/trusted_checks/phase1.mjs:32) | <code>  const port = await unusedPort();</code> | Allocate a port rather than assuming 8080 is free. |
| [33](/C:/AI_employee/trusted_checks/phase1.mjs:33) | <code>  const executable = join(source, 'build', 'team-tasks.exe');</code> | Select this checkout's executable. |
| [34](/C:/AI_employee/trusted_checks/phase1.mjs:34) | <code>  const child = spawn(executable, ['--db', db, '--static', join(source, 'build', 'static'), '--port', String(port), '--scenario', scenarioName], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });</code> | Start it directly with database, frozen assets and loopback port, hiding the window and piping logs. No shell is used to interpret these arguments. |
| [35](/C:/AI_employee/trusted_checks/phase1.mjs:35) | <code>  activeServer = child;</code> | Remember it for failure cleanup. |
| [36](/C:/AI_employee/trusted_checks/phase1.mjs:36) | <code>  let logs = '';</code> | Initialize a string log buffer. |
| [37](/C:/AI_employee/trusted_checks/phase1.mjs:37) | <code>  child.stdout.on('data', data =&gt; { logs += data; });</code> | Collect its stdout bytes as text. |
| [38](/C:/AI_employee/trusted_checks/phase1.mjs:38) | <code>  child.stderr.on('data', data =&gt; { logs += data; });</code> | Collect its stderr bytes as text. |
| [39](/C:/AI_employee/trusted_checks/phase1.mjs:39) | <code>  const origin = `http://127.0.0.1:${port}`;</code> | Build this server's exact allowed origin. |
| [40](/C:/AI_employee/trusted_checks/phase1.mjs:40) | <code>  for (let attempt = 0; attempt &lt; 60; attempt++) {</code> | Bound readiness attempts to 60. |
| [41](/C:/AI_employee/trusted_checks/phase1.mjs:41) | <code>    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);</code> | Abort immediately if the child exited before becoming ready. |
| [42](/C:/AI_employee/trusted_checks/phase1.mjs:42) | <code>    try {</code> | Begin a transient readiness probe. |
| [43](/C:/AI_employee/trusted_checks/phase1.mjs:43) | <code>      const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(500) });</code> | GET health with a 500ms request timeout. |
| [44](/C:/AI_employee/trusted_checks/phase1.mjs:44) | <code>      if (response.ok) return { child, origin, logs: () =&gt; logs };</code> | Return child/origin/log access when health responds successfully. |
| [45](/C:/AI_employee/trusted_checks/phase1.mjs:45) | <code>    } catch {}</code> | Ignore a transient connection/readiness failure only within this bounded read loop. |
| [46](/C:/AI_employee/trusted_checks/phase1.mjs:46) | <code>    await new Promise(resolve =&gt; setTimeout(resolve, 100));</code> | Delay 100ms before the next attempt. |
| [47](/C:/AI_employee/trusted_checks/phase1.mjs:47) | <code>  }</code> | Close readiness iteration. |
| [48](/C:/AI_employee/trusted_checks/phase1.mjs:48) | <code>  throw new Error(`Server readiness timeout: ${logs}`);</code> | Throw when all readiness attempts are exhausted. Time includes request timeouts, so it is not exactly six seconds. |
| [49](/C:/AI_employee/trusted_checks/phase1.mjs:49) | <code>}</code> | Close launch. |
| [50](/C:/AI_employee/trusted_checks/phase1.mjs:50) | <code>async function stop(child) {</code> | Define owned-server cleanup. |
| [51](/C:/AI_employee/trusted_checks/phase1.mjs:51) | <code>  if (!child &#124;&#124; child.exitCode !== null &#124;&#124; child.signalCode !== null) return;</code> | Return if no child or it has already exited/been signalled. |
| [52](/C:/AI_employee/trusted_checks/phase1.mjs:52) | <code>  const closed = once(child, 'exit');</code> | Register for the exit event before sending termination to avoid missing it. |
| [53](/C:/AI_employee/trusted_checks/phase1.mjs:53) | <code>  child.kill();</code> | Terminate that child process; no shared application process is selected by name. |
| [54](/C:/AI_employee/trusted_checks/phase1.mjs:54) | <code>  await closed;</code> | Wait for the exit event. The current helper does not add a separate timeout around this wait. |
| [55](/C:/AI_employee/trusted_checks/phase1.mjs:55) | <code>  if (activeServer === child) activeServer = null;</code> | Clear activeServer when this was the remembered current server. |
| [56](/C:/AI_employee/trusted_checks/phase1.mjs:56) | <code>}</code> | Close stop. |
| [57](/C:/AI_employee/trusted_checks/phase1.mjs:57) | <code>async function request(origin, path, method = 'GET', body, extraHeaders = {}) {</code> | Define HTTP test requests with default GET and optional body/headers. |
| [58](/C:/AI_employee/trusted_checks/phase1.mjs:58) | <code>  const response = await fetch(origin + path, { method, headers: { ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...extraHeaders }, ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {}), signal: AbortSignal.timeout(5000) });</code> | Send bounded HTTP fetch: serialize object bodies, leave raw-string bodies raw for malformed-JSON tests, add JSON Content-Type when a body is supplied, and allow extra test headers. |
| [59](/C:/AI_employee/trusted_checks/phase1.mjs:59) | <code>  const text = await response.text();</code> | Read response body as text. |
| [60](/C:/AI_employee/trusted_checks/phase1.mjs:60) | <code>  let data;</code> | Reserve parsed-result storage. |
| [61](/C:/AI_employee/trusted_checks/phase1.mjs:61) | <code>  try { data = text ? JSON.parse(text) : null; } catch { data = text; }</code> | Parse JSON when possible; preserve non-JSON response text instead of crashing the reporting helper. |
| [62](/C:/AI_employee/trusted_checks/phase1.mjs:62) | <code>  return { status: response.status, data };</code> | Return status and parsed/raw data so assertions can inspect them independently. |
| [63](/C:/AI_employee/trusted_checks/phase1.mjs:63) | <code>}</code> | Close request. |
| [64](/C:/AI_employee/trusted_checks/phase1.mjs:64) | <code>const ids = tasks =&gt; tasks.map(task =&gt; task.id).join(',');</code> | Convert a list of task IDs into a comma-separated comparison string. |
| [65](/C:/AI_employee/trusted_checks/phase1.mjs:65) | <code>(blank)</code> | Blank separator for readability; no runtime operation. |
| [66](/C:/AI_employee/trusted_checks/phase1.mjs:66) | <code>try {</code> | Begin the whole suite's error/final-cleanup boundary. |
| [67](/C:/AI_employee/trusted_checks/phase1.mjs:67) | <code>  browser = await chromium.launch({ channel: 'chrome', headless: true });</code> | Launch installed Chrome headlessly through Playwright. |
| [68](/C:/AI_employee/trusted_checks/phase1.mjs:68) | <code>  report.browser_version=browser.version();</code> | Record actual browser version. |
| [69](/C:/AI_employee/trusted_checks/phase1.mjs:69) | <code>  report.node_version=process.version;</code> | Record actual Node runtime version. |
| [70](/C:/AI_employee/trusted_checks/phase1.mjs:70) | <code>  for (const name of ['clean', 'frontend', 'backend', 'feature']) {</code> | Run four independent source baseline scenarios. |
| [71](/C:/AI_employee/trusted_checks/phase1.mjs:71) | <code>    const source = name === 'clean' ? join(root, 'playground') : join(root, 'var', 'fixtures', name);</code> | Select clean repository or a scenario worktree. |
| [72](/C:/AI_employee/trusted_checks/phase1.mjs:72) | <code>    const executable = join(source, 'build', 'team-tasks.exe');</code> | Locate its executable. |
| [73](/C:/AI_employee/trusted_checks/phase1.mjs:73) | <code>    if (!existsSync(executable)) throw new Error(`Build missing for ${name}`);</code> | Fail clearly if it has not been built. |
| [74](/C:/AI_employee/trusted_checks/phase1.mjs:74) | <code>    const db = join(output, `${name}.db`);</code> | Assign a new scenario database inside this unique run, leaving manual var/data databases untouched. |
| [75](/C:/AI_employee/trusted_checks/phase1.mjs:75) | <code>    execFileSync(executable, ['--db', db, '--seed'], { windowsHide: true, timeout: 5000 });</code> | Seed only that fresh database with a bounded direct CLI call; no server is running on it yet. |
| [76](/C:/AI_employee/trusted_checks/phase1.mjs:76) | <code>    let server = await launch(source, db, name);</code> | Launch the real app. |
| [77](/C:/AI_employee/trusted_checks/phase1.mjs:77) | <code>    let origin = server.origin;</code> | Save its current origin; a restart below can receive a different port. |
| [78](/C:/AI_employee/trusted_checks/phase1.mjs:78) | <code>    const scenario = { name, metadata: (await request(origin, '/api/health')).data, assertions: [] };</code> | Fetch health metadata and initialize the scenario's assertion array. |
| [79](/C:/AI_employee/trusted_checks/phase1.mjs:79) | <code>    report.scenarios.push(scenario);</code> | Attach this scenario to the report immediately so partial failures still leave evidence. |
| [80](/C:/AI_employee/trusted_checks/phase1.mjs:80) | <code>    scenario.build_info = JSON.parse((await readFile(join(source,'build','build-info.json'),'utf8')).replace(/^\uFEFF/,''));</code> | Read build-info.json and remove a possible PowerShell UTF-8 BOM before JSON parsing. |
| [81](/C:/AI_employee/trusted_checks/phase1.mjs:81) | <code>    record(scenario, 'commit_and_build_recorded', /^[a-f0-9]{40}$/.test(scenario.metadata.commit) &amp;&amp; /^[a-f0-9]{64}$/.test(scenario.metadata.build), scenario.metadata);</code> | Require a 40-digit hexadecimal commit and 64-digit build digest; this format check does not independently prove source integrity. |
| [82](/C:/AI_employee/trusted_checks/phase1.mjs:82) | <code>    record(scenario, 'metadata_matches_build', scenario.metadata.commit === scenario.build_info.commit &amp;&amp; scenario.metadata.build === scenario.build_info.build, scenario.build_info);</code> | Compare health's compiled identity to the build record; it does not recompute all source hashes or attest against a malicious binary. |
| [83](/C:/AI_employee/trusted_checks/phase1.mjs:83) | <code>    const all = await request(origin, '/api/tasks');</code> | Fetch all tasks from the actual app. |
| [84](/C:/AI_employee/trusted_checks/phase1.mjs:84) | <code>    record(scenario, 'seed_exact_rows', all.status === 200 &amp;&amp; ids(all.data.tasks) === '1,2,3,4' &amp;&amp; all.data.tasks.map(t=&gt;t.status).join(',') === 'todo,todo,in_progress,done', all);</code> | Require exact seeded IDs/order and status sequence; passing a process exit code alone would not establish this. |
| [85](/C:/AI_employee/trusted_checks/phase1.mjs:85) | <code>    for (const [status, expected] of [['todo','1,2'],['in_progress','3'],['done','4']]) {</code> | Enumerate independent expected results for todo, in_progress and done. |
| [86](/C:/AI_employee/trusted_checks/phase1.mjs:86) | <code>      const result = await request(origin, `/api/tasks?status=${status}`);</code> | Fetch each status API result. |
| [87](/C:/AI_employee/trusted_checks/phase1.mjs:87) | <code>      record(scenario, `api_filter_${status}`, result.status === 200 &amp;&amp; ids(result.data.tasks) === expected, {expected_ids:expected, result});</code> | Record whether status/result IDs match the independent expectation; retain a FAIL for the backend todo defect. |
| [88](/C:/AI_employee/trusted_checks/phase1.mjs:88) | <code>    }</code> | Close filter assertions. |
| [89](/C:/AI_employee/trusted_checks/phase1.mjs:89) | <code>    for (const query of ['status=unknown','status=','status=todo&amp;status=done',"status=todo%27%20OR%201%3D1--",'extra=1']) {</code> | Enumerate invalid/empty/duplicate/injection-like/unknown query cases. |
| [90](/C:/AI_employee/trusted_checks/phase1.mjs:90) | <code>      const result = await request(origin, '/api/tasks?' + query);</code> | Request each query directly. |
| [91](/C:/AI_employee/trusted_checks/phase1.mjs:91) | <code>      record(scenario, 'reject_query_' + query, result.status === 400, result);</code> | Require HTTP 400 for each invalid query. |
| [92](/C:/AI_employee/trusted_checks/phase1.mjs:92) | <code>    }</code> | Close query-validation tests. |
| [93](/C:/AI_employee/trusted_checks/phase1.mjs:93) | <code>    for (const [label, body] of [['blank',{title:'  '}],['too_long',{title:'x'.repeat(121)}],['wrong_type',{title:42}],['unknown_field',{title:'task',permission:'admin'}],['bad_status',{title:'task',status:'invalid'}],['missing',{}],['malformed','{'],['not_object',[]],['nul',{title:'a\u0000b'}]]) {</code> | Enumerate nine invalid creation payloads: blank, long, wrong type, unknown field, bad enum, missing title, malformed JSON, array and embedded NUL. |
| [94](/C:/AI_employee/trusted_checks/phase1.mjs:94) | <code>      const result = await request(origin, '/api/tasks', 'POST', body);</code> | POST the selected payload. |
| [95](/C:/AI_employee/trusted_checks/phase1.mjs:95) | <code>      record(scenario, 'reject_create_' + label, result.status === 400, result);</code> | Require HTTP 400; do not invent success from model commentary. |
| [96](/C:/AI_employee/trusted_checks/phase1.mjs:96) | <code>    }</code> | Close invalid-create tests. |
| [97](/C:/AI_employee/trusted_checks/phase1.mjs:97) | <code>    const crossOrigin = await request(origin, '/api/tasks','POST',{title:'Unwanted cross-origin task'},{Origin:'https://untrusted.example'});</code> | Submit a write with a deliberately untrusted Origin header. |
| [98](/C:/AI_employee/trusted_checks/phase1.mjs:98) | <code>    record(scenario,'deny_cross_origin_write',crossOrigin.status === 403,crossOrigin);</code> | Require 403, demonstrating this particular browser-origin guard; it is not authentication or general isolation. |
| [99](/C:/AI_employee/trusted_checks/phase1.mjs:99) | <code>    const missing = await request(origin, '/api/tasks/999999','PATCH',{status:'done'});</code> | PATCH a positive but nonexistent ID. |
| [100](/C:/AI_employee/trusted_checks/phase1.mjs:100) | <code>    record(scenario,'missing_task_404',missing.status === 404,missing);</code> | Require 404 for that missing row. |
| [101](/C:/AI_employee/trusted_checks/phase1.mjs:101) | <code>    const invalidPatch = await request(origin, '/api/tasks/1','PATCH',{status:'unexpected'});</code> | PATCH task 1 with an unsupported status. |
| [102](/C:/AI_employee/trusted_checks/phase1.mjs:102) | <code>    record(scenario,'reject_invalid_update',invalidPatch.status === 400,invalidPatch);</code> | Require 400 before an update. |
| [103](/C:/AI_employee/trusted_checks/phase1.mjs:103) | <code>    const oversizedId = await request(origin, '/api/tasks/99999999999999999999999999','DELETE');</code> | DELETE an ID too large for long long. |
| [104](/C:/AI_employee/trusted_checks/phase1.mjs:104) | <code>    record(scenario,'reject_overflow_id',oversizedId.status === 400,oversizedId);</code> | Require 400 for numeric overflow. |
| [105](/C:/AI_employee/trusted_checks/phase1.mjs:105) | <code>    const advanced = await request(origin, '/api/tasks/1','PATCH',{status:'in_progress'});</code> | Advance task 1 through the API. |
| [106](/C:/AI_employee/trusted_checks/phase1.mjs:106) | <code>    record(scenario,'api_status_update',advanced.status === 200 &amp;&amp; advanced.data.status === 'in_progress',advanced);</code> | Require 200 and the updated in_progress value. |
| [107](/C:/AI_employee/trusted_checks/phase1.mjs:107) | <code>    await request(origin, '/api/tasks/1','PATCH',{status:'todo'});</code> | Restore task 1 to todo in this test database before later baseline observations. |
| [108](/C:/AI_employee/trusted_checks/phase1.mjs:108) | <code>    const created = await request(origin, '/api/tasks','POST',{title:"Persistent O'Reilly &lt;script&gt; task", description:'Restart persistence probe'});</code> | Create a task containing an apostrophe and literal script text; this tests data handling and supplies the restart probe. |
| [109](/C:/AI_employee/trusted_checks/phase1.mjs:109) | <code>    record(scenario,'api_create',created.status === 201 &amp;&amp; created.data.status === 'todo',created);</code> | Require HTTP 201 and default todo. |
| [110](/C:/AI_employee/trusted_checks/phase1.mjs:110) | <code>    await stop(server.child);</code> | Terminate the real server. |
| [111](/C:/AI_employee/trusted_checks/phase1.mjs:111) | <code>    server = await launch(source,db,name);</code> | Restart the same executable against the same database file. |
| [112](/C:/AI_employee/trusted_checks/phase1.mjs:112) | <code>    origin = server.origin;</code> | Update origin to the restart's actual port. |
| [113](/C:/AI_employee/trusted_checks/phase1.mjs:113) | <code>    const afterRestart = await request(origin,'/api/tasks');</code> | Fetch all persisted rows after restart. |
| [114](/C:/AI_employee/trusted_checks/phase1.mjs:114) | <code>    record(scenario,'restart_persistence',afterRestart.data.tasks.some(task=&gt;task.id === created.data.id &amp;&amp; task.title === created.data.title),afterRestart);</code> | Require the same created ID/title after process death and restart, proving this persistence path is not browser memory. |
| [115](/C:/AI_employee/trusted_checks/phase1.mjs:115) | <code>    const removed = await request(origin, `/api/tasks/${created.data.id}`,'DELETE');</code> | DELETE that extra test row. |
| [116](/C:/AI_employee/trusted_checks/phase1.mjs:116) | <code>    const removedAgain = await request(origin, `/api/tasks/${created.data.id}`,'DELETE');</code> | DELETE the same ID again. |
| [117](/C:/AI_employee/trusted_checks/phase1.mjs:117) | <code>    record(scenario,'delete_and_missing',removed.status === 204 &amp;&amp; removedAgain.status === 404,{removed,removedAgain});</code> | Require first 204 then 404, exercising removal and absent-row behavior. |
| [118](/C:/AI_employee/trusted_checks/phase1.mjs:118) | <code>    const browserErrors = [];</code> | Start an array of actual browser JavaScript errors. |
| [119](/C:/AI_employee/trusted_checks/phase1.mjs:119) | <code>    const context = await browser.newContext({viewport:{width:390,height:844}});</code> | Create a fresh browser context at the mobile viewport. |
| [120](/C:/AI_employee/trusted_checks/phase1.mjs:120) | <code>    const page = await context.newPage();</code> | Open its page. |
| [121](/C:/AI_employee/trusted_checks/phase1.mjs:121) | <code>    page.on('pageerror',error=&gt;browserErrors.push(error.message));</code> | Collect pageerror messages for later assertion. |
| [122](/C:/AI_employee/trusted_checks/phase1.mjs:122) | <code>    for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {</code> | Observe both agreed viewport sizes. |
| [123](/C:/AI_employee/trusted_checks/phase1.mjs:123) | <code>      await page.setViewportSize(viewport);</code> | Apply viewport size. |
| [124](/C:/AI_employee/trusted_checks/phase1.mjs:124) | <code>      await page.goto(origin);</code> | Navigate to this controlled local app. |
| [125](/C:/AI_employee/trusted_checks/phase1.mjs:125) | <code>      await page.locator('.task-card').nth(3).waitFor();</code> | Wait for the fourth seeded card to exist. |
| [126](/C:/AI_employee/trusted_checks/phase1.mjs:126) | <code>      await page.locator('#task-list[aria-busy="false"]').waitFor();</code> | Wait for task-list loading to complete. |
| [127](/C:/AI_employee/trusted_checks/phase1.mjs:127) | <code>      const screenshotName = `${name}-${viewport.width}x${viewport.height}.png`;</code> | Name screenshot with scenario and exact viewport. |
| [128](/C:/AI_employee/trusted_checks/phase1.mjs:128) | <code>      await page.screenshot({path:join(output,screenshotName),fullPage:true});</code> | Save a full-page screenshot; viewport and screenshot total image height are different concepts when the page scrolls. |
| [129](/C:/AI_employee/trusted_checks/phase1.mjs:129) | <code>      const geometry = await page.locator('.task-card').evaluateAll(cards=&gt;cards.map(card=&gt;{</code> | Run measurement code inside the page over all task cards. |
| [130](/C:/AI_employee/trusted_checks/phase1.mjs:130) | <code>        const rectangle = element =&gt; {</code> | Define conversion of one element to a plain rectangle object. |
| [131](/C:/AI_employee/trusted_checks/phase1.mjs:131) | <code>          const r = element.getBoundingClientRect();</code> | Read its actual browser layout rectangle. |
| [132](/C:/AI_employee/trusted_checks/phase1.mjs:132) | <code>          return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};</code> | Copy position/size/right/bottom into evidence-friendly fields. |
| [133](/C:/AI_employee/trusted_checks/phase1.mjs:133) | <code>        };</code> | Close rectangle helper. |
| [134](/C:/AI_employee/trusted_checks/phase1.mjs:134) | <code>        const buttons = [...card.querySelectorAll('.task-actions button')];</code> | Select the two action buttons for this card. |
| [135](/C:/AI_employee/trusted_checks/phase1.mjs:135) | <code>        const [a,b] = buttons.map(rectangle);</code> | Measure them as rectangles a and b. |
| [136](/C:/AI_employee/trusted_checks/phase1.mjs:136) | <code>        const parent = rectangle(card);</code> | Measure their containing card. |
| [137](/C:/AI_employee/trusted_checks/phase1.mjs:137) | <code>        const overlap = Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));</code> | Compute overlap area: intersection width times intersection height, each clamped to zero. Any positive result means geometric intersection. |
| [138](/C:/AI_employee/trusted_checks/phase1.mjs:138) | <code>        return {id:card.dataset.taskId,a,b,overlap,visible:buttons.every(button=&gt;{const r=rectangle(button);return r.width&gt;0 &amp;&amp; r.height&gt;0 &amp;&amp; !button.disabled &amp;&amp; getComputedStyle(button).visibility!=='hidden' &amp;&amp; getComputedStyle(button).display!=='none' &amp;&amp; r.x&gt;=parent.x &amp;&amp; r.right&lt;=parent.right+.1 &amp;&amp; r.y&gt;=parent.y &amp;&amp; r.bottom&lt;=parent.bottom+.1;})};</code> | Return card ID/rectangles/overlap and a visibility predicate requiring positive dimensions, enabled controls, visible/displayed styles and bounds within the card. This selected predicate does not prove all possible visibility/click conditions. |
| [139](/C:/AI_employee/trusted_checks/phase1.mjs:139) | <code>      }));</code> | Close per-card/page geometry evaluation. |
| [140](/C:/AI_employee/trusted_checks/phase1.mjs:140) | <code>      record(scenario,`geometry_${viewport.width}`,geometry.length === 4 &amp;&amp; geometry.every(card=&gt;card.overlap===0 &amp;&amp; card.visible),geometry,screenshotName);</code> | Require four cards, zero action overlap and the recorded visibility predicate for each; attach screenshot reference. Frontend mobile baseline deliberately FAILs. |
| [141](/C:/AI_employee/trusted_checks/phase1.mjs:141) | <code>      const horizontalOverflow = await page.evaluate(()=&gt;document.documentElement.scrollWidth&gt;window.innerWidth);</code> | Compare document scroll width with viewport width to detect horizontal page overflow. |
| [142](/C:/AI_employee/trusted_checks/phase1.mjs:142) | <code>      record(scenario,`no_page_overflow_${viewport.width}`,!horizontalOverflow,{horizontalOverflow},screenshotName);</code> | Require no page overflow and save the observed boolean/screenshot reference. |
| [143](/C:/AI_employee/trusted_checks/phase1.mjs:143) | <code>      record(scenario,`card_content_${viewport.width}`,await page.locator('.task-card h3').allTextContents().then(t=&gt;t.join('&#124;') === 'Plan the team kickoff&#124;Review the design notes&#124;Build the task board&#124;Prepare the demo checklist'),await page.locator('.task-card h3').allTextContents(),screenshotName);</code> | Require all four seeded titles in exact order at this viewport; missing/hiding cards cannot silently satisfy the geometry check. |
| [144](/C:/AI_employee/trusted_checks/phase1.mjs:144) | <code>    }</code> | Close viewport observation loop. |
| [145](/C:/AI_employee/trusted_checks/phase1.mjs:145) | <code>    await page.setViewportSize({width:390,height:844});</code> | Return to mobile for interaction tests. |
| [146](/C:/AI_employee/trusted_checks/phase1.mjs:146) | <code>    await page.getByRole('button',{name:'To do',exact:true}).click();</code> | Click the actual To do filter button by accessible name. |
| [147](/C:/AI_employee/trusted_checks/phase1.mjs:147) | <code>    await page.locator('#task-list[aria-busy="false"]').waitFor();</code> | Wait for the resulting fetch/render to finish. |
| [148](/C:/AI_employee/trusted_checks/phase1.mjs:148) | <code>    const filteredIds = await page.locator('.task-card').evaluateAll(cards=&gt;cards.map(card=&gt;card.dataset.taskId).join(','));</code> | Read actual displayed card IDs. |
| [149](/C:/AI_employee/trusted_checks/phase1.mjs:149) | <code>    record(scenario,'ui_todo_filter',filteredIds === '1,2',{expected:'1,2',actual:filteredIds});</code> | Require IDs 1,2; backend's incorrect returned rows produce a retained UI FAIL as well as the independent API FAIL. |
| [150](/C:/AI_employee/trusted_checks/phase1.mjs:150) | <code>    await page.getByRole('button',{name:'All tasks',exact:true}).click();</code> | Return to All tasks. |
| [151](/C:/AI_employee/trusted_checks/phase1.mjs:151) | <code>    await page.locator('#task-list[aria-busy="false"]').waitFor();</code> | Wait for the reload. |
| [152](/C:/AI_employee/trusted_checks/phase1.mjs:152) | <code>    await page.locator('[data-task-id="1"] .advance').click();</code> | Click task 1's real advance button. |
| [153](/C:/AI_employee/trusted_checks/phase1.mjs:153) | <code>    await page.getByRole('status').filter({hasText:'Task status updated.'}).waitFor();</code> | Wait for the successful status-update message. |
| [154](/C:/AI_employee/trusted_checks/phase1.mjs:154) | <code>    await page.locator('#task-list[aria-busy="false"]').waitFor();</code> | Wait for reload completion. |
| [155](/C:/AI_employee/trusted_checks/phase1.mjs:155) | <code>    const updated = (await request(origin,'/api/tasks')).data.tasks.find(task=&gt;task.id === 1);</code> | Read task 1 through the API for independent state confirmation. |
| [156](/C:/AI_employee/trusted_checks/phase1.mjs:156) | <code>    record(scenario,'mobile_advance_click',updated.status === 'in_progress',updated);</code> | Require it to be in_progress after the click. |
| [157](/C:/AI_employee/trusted_checks/phase1.mjs:157) | <code>    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Complete task'}).waitFor();</code> | Wait until its next action says Complete task. |
| [158](/C:/AI_employee/trusted_checks/phase1.mjs:158) | <code>    const completeResponse = page.waitForResponse(response=&gt;response.url().endsWith('/api/tasks/1') &amp;&amp; response.request().method()==='PATCH');</code> | Set up a response wait before clicking, specifically matching task 1's PATCH. |
| [159](/C:/AI_employee/trusted_checks/phase1.mjs:159) | <code>    await page.locator('[data-task-id="1"] .advance').click();</code> | Click to complete it. |
| [160](/C:/AI_employee/trusted_checks/phase1.mjs:160) | <code>    await completeResponse;</code> | Wait for the actual PATCH response. |
| [161](/C:/AI_employee/trusted_checks/phase1.mjs:161) | <code>    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Reopen task'}).waitFor();</code> | Wait until UI action changes to Reopen task. |
| [162](/C:/AI_employee/trusted_checks/phase1.mjs:162) | <code>    const completed = (await request(origin,'/api/tasks')).data.tasks.find(task=&gt;task.id === 1);</code> | Fetch task 1's persisted state. |
| [163](/C:/AI_employee/trusted_checks/phase1.mjs:163) | <code>    record(scenario,'mobile_complete_click',completed.status === 'done',completed);</code> | Require done. |
| [164](/C:/AI_employee/trusted_checks/phase1.mjs:164) | <code>    const reopenResponse = page.waitForResponse(response=&gt;response.url().endsWith('/api/tasks/1') &amp;&amp; response.request().method()==='PATCH');</code> | Prepare the response wait for the reopening PATCH. |
| [165](/C:/AI_employee/trusted_checks/phase1.mjs:165) | <code>    await page.locator('[data-task-id="1"] .advance').click();</code> | Click Reopen task. |
| [166](/C:/AI_employee/trusted_checks/phase1.mjs:166) | <code>    await reopenResponse;</code> | Wait for its PATCH response. |
| [167](/C:/AI_employee/trusted_checks/phase1.mjs:167) | <code>    await page.locator('[data-task-id="1"] .advance').filter({hasText:'Start task'}).waitFor();</code> | Wait until the UI action returns to Start task. |
| [168](/C:/AI_employee/trusted_checks/phase1.mjs:168) | <code>    const reopened = (await request(origin,'/api/tasks')).data.tasks.find(task=&gt;task.id === 1);</code> | Fetch task 1's persisted state again. |
| [169](/C:/AI_employee/trusted_checks/phase1.mjs:169) | <code>    record(scenario,'mobile_reopen_click',reopened.status === 'todo',reopened);</code> | Require todo after reopening. |
| [170](/C:/AI_employee/trusted_checks/phase1.mjs:170) | <code>    await page.reload();</code> | Refresh the browser page. |
| [171](/C:/AI_employee/trusted_checks/phase1.mjs:171) | <code>    await page.locator('.task-card').nth(3).waitFor();</code> | Wait for all four baseline cards. |
| [172](/C:/AI_employee/trusted_checks/phase1.mjs:172) | <code>    await page.locator('#title').fill('&lt;img src=x onerror="window.taskXss=1"&gt;');</code> | Enter text that would create an image/onerror side effect if treated as HTML. |
| [173](/C:/AI_employee/trusted_checks/phase1.mjs:173) | <code>    await page.locator('#description').fill('Created through the browser');</code> | Enter synthetic description text. |
| [174](/C:/AI_employee/trusted_checks/phase1.mjs:174) | <code>    await page.getByRole('button',{name:'Create task',exact:false}).click();</code> | Submit the real creation form. |
| [175](/C:/AI_employee/trusted_checks/phase1.mjs:175) | <code>    await page.getByRole('status').filter({hasText:'Task created and saved.'}).waitFor();</code> | Wait for successful creation acknowledgment. |
| [176](/C:/AI_employee/trusted_checks/phase1.mjs:176) | <code>    await page.locator('.task-card').nth(4).waitFor();</code> | Require a fifth visible card before refreshing. |
| [177](/C:/AI_employee/trusted_checks/phase1.mjs:177) | <code>    await page.reload();</code> | Refresh to exercise backend re-fetch/persistence. |
| [178](/C:/AI_employee/trusted_checks/phase1.mjs:178) | <code>    const injected = page.locator('.task-card').filter({has:page.locator('h3',{hasText:'&lt;img src=x onerror="window.taskXss=1"&gt;'})});</code> | Locate the created card by literal heading text rather than guessed DOM HTML. |
| [179](/C:/AI_employee/trusted_checks/phase1.mjs:179) | <code>    await injected.waitFor();</code> | Wait for that card after reload. |
| [180](/C:/AI_employee/trusted_checks/phase1.mjs:180) | <code>    record(scenario,'browser_create_refresh_text_safety',await injected.locator('h3').textContent() === '&lt;img src=x onerror="window.taskXss=1"&gt;' &amp;&amp; await page.evaluate(()=&gt;!window.taskXss &amp;&amp; document.querySelectorAll('.task-card img').length===0),{title:await injected.locator('h3').textContent()});</code> | Require exact literal title, no taskXss side effect and no image inside task cards. This is one concrete injection-like case, not an exhaustive security guarantee. |
| [181](/C:/AI_employee/trusted_checks/phase1.mjs:181) | <code>    page.once('dialog',dialog=&gt;dialog.accept());</code> | Accept only the next browser confirmation dialog, so the removal path can proceed. |
| [182](/C:/AI_employee/trusted_checks/phase1.mjs:182) | <code>    await injected.locator('.remove').click();</code> | Click the created card's actual remove control. |
| [183](/C:/AI_employee/trusted_checks/phase1.mjs:183) | <code>    await page.getByRole('status').filter({hasText:'Task removed.'}).waitFor();</code> | Wait for removal acknowledgment. |
| [184](/C:/AI_employee/trusted_checks/phase1.mjs:184) | <code>    await page.locator('#task-list[aria-busy="false"]').waitFor();</code> | Wait for result-list reload. |
| [185](/C:/AI_employee/trusted_checks/phase1.mjs:185) | <code>    record(scenario,'mobile_remove_click',await page.locator('.task-card').count()===4,{cards:await page.locator('.task-card').count()});</code> | Require exactly four cards again. |
| [186](/C:/AI_employee/trusted_checks/phase1.mjs:186) | <code>    const completedFilter = await page.locator('[data-filter="done"]').count();</code> | Count dedicated Completed filter controls. |
| [187](/C:/AI_employee/trusted_checks/phase1.mjs:187) | <code>    record(scenario,'completed_feature_acceptance',completedFilter === 1,{expected_completed_control:1,actual:completedFilter,meaning:'Intentionally absent feature; API done filter is independently checked.'});</code> | Record the feature's criterion as FAIL while that button is absent. This failure is intentionally preserved even for clean baseline. |
| [188](/C:/AI_employee/trusted_checks/phase1.mjs:188) | <code>    for (const id of [1,2,3,4]) await request(origin,`/api/tasks/${id}`,'DELETE');</code> | Remove the four seeded rows only in this test database to check the empty state. |
| [189](/C:/AI_employee/trusted_checks/phase1.mjs:189) | <code>    await page.reload();</code> | Refresh after deletion. |
| [190](/C:/AI_employee/trusted_checks/phase1.mjs:190) | <code>    await page.locator('#empty').waitFor({state:'visible'});</code> | Wait for the empty-state message to become visible. |
| [191](/C:/AI_employee/trusted_checks/phase1.mjs:191) | <code>    record(scenario,'empty_state',await page.locator('.task-card').count()===0 &amp;&amp; await page.locator('#task-count').textContent()==='0 tasks',{message:await page.locator('#empty').textContent()});</code> | Require zero cards and the visible count text 0 tasks. |
| [192](/C:/AI_employee/trusted_checks/phase1.mjs:192) | <code>    record(scenario,'browser_no_exceptions',browserErrors.length===0,browserErrors);</code> | Require no collected page JavaScript exceptions; this does not check every browser console message. |
| [193](/C:/AI_employee/trusted_checks/phase1.mjs:193) | <code>    await context.close();</code> | Close this browser context. |
| [194](/C:/AI_employee/trusted_checks/phase1.mjs:194) | <code>    await stop(server.child);</code> | Stop its server before using CLI reset. |
| [195](/C:/AI_employee/trusted_checks/phase1.mjs:195) | <code>    // Exercise reset on an existing, modified synthetic database only after stopping its server.</code> | Comment explains why reset is exercised on an existing modified database after the server stops. |
| [196](/C:/AI_employee/trusted_checks/phase1.mjs:196) | <code>    execFileSync(executable,['--db',db,'--seed'],{windowsHide:true,timeout:5000});</code> | Run seed mode with a five-second cap, restoring that test database. |
| [197](/C:/AI_employee/trusted_checks/phase1.mjs:197) | <code>    server = await launch(source,db,name);</code> | Launch a real server again to inspect the reset. |
| [198](/C:/AI_employee/trusted_checks/phase1.mjs:198) | <code>    const resetRows = await request(server.origin,'/api/tasks');</code> | Fetch its task rows. |
| [199](/C:/AI_employee/trusted_checks/phase1.mjs:199) | <code>    record(scenario,'developer_reset_restores_seed',ids(resetRows.data.tasks)==='1,2,3,4' &amp;&amp; resetRows.data.tasks.map(t=&gt;t.status).join(',')==='todo,todo,in_progress,done',resetRows);</code> | Require restored IDs 1–4 and their original status sequence. |
| [200](/C:/AI_employee/trusted_checks/phase1.mjs:200) | <code>    await stop(server.child);</code> | Stop the inspection server. |
| [201](/C:/AI_employee/trusted_checks/phase1.mjs:201) | <code>    const expectedFailures = ['completed_feature_acceptance',...(name === 'frontend' ? ['geometry_390'] : []),...(name === 'backend' ? ['api_filter_todo','ui_todo_filter'] : [])].sort();</code> | Compute the expected baseline FAIL names: missing feature for all, mobile overlap for frontend, todo API/UI rows for backend. This is evaluator expectation, not a runtime repair table. |
| [202](/C:/AI_employee/trusted_checks/phase1.mjs:202) | <code>    const actualFailures = scenario.assertions.filter(a=&gt;a.status==='FAIL').map(a=&gt;a.name).sort();</code> | Gather and sort actual FAIL names from recorded assertions. |
| [203](/C:/AI_employee/trusted_checks/phase1.mjs:203) | <code>    scenario.expected_baseline_failures=expectedFailures;</code> | Record the expected baseline failures explicitly. |
| [204](/C:/AI_employee/trusted_checks/phase1.mjs:204) | <code>    scenario.observed_failures=actualFailures;</code> | Record the actual failures explicitly. |
| [205](/C:/AI_employee/trusted_checks/phase1.mjs:205) | <code>    scenario.baseline_matches_expected = JSON.stringify(actualFailures) === JSON.stringify(expectedFailures);</code> | Require exact matching lists: unexpected failures or a removed intentional defect both change the suite outcome. |
| [206](/C:/AI_employee/trusted_checks/phase1.mjs:206) | <code>    console.log(`${name}: ${scenario.assertions.filter(a=&gt;a.status==='PASS').length} PASS, ${actualFailures.length} FAIL; fixture matches expected=${scenario.baseline_matches_expected}`);</code> | Print actual counts and whether the baseline matches its expected observations. |
| [207](/C:/AI_employee/trusted_checks/phase1.mjs:207) | <code>  }</code> | Close scenario iteration. |
| [208](/C:/AI_employee/trusted_checks/phase1.mjs:208) | <code>} catch (error) {</code> | Catch a suite execution error, such as missing build or failed browser wait. |
| [209](/C:/AI_employee/trusted_checks/phase1.mjs:209) | <code>  report.execution_error=error.stack;</code> | Preserve its stack in the report. |
| [210](/C:/AI_employee/trusted_checks/phase1.mjs:210) | <code>  console.error(error.stack);</code> | Print the execution error. |
| [211](/C:/AI_employee/trusted_checks/phase1.mjs:211) | <code>} finally {</code> | Enter final cleanup/report persistence even if the suite failed. |
| [212](/C:/AI_employee/trusted_checks/phase1.mjs:212) | <code>  await stop(activeServer);</code> | Stop any currently owned server. |
| [213](/C:/AI_employee/trusted_checks/phase1.mjs:213) | <code>  if (browser) await browser.close();</code> | Close the browser if it launched. |
| [214](/C:/AI_employee/trusted_checks/phase1.mjs:214) | <code>  report.finished_at=new Date().toISOString();</code> | Record final UTC time. |
| [215](/C:/AI_employee/trusted_checks/phase1.mjs:215) | <code>  report.phase1_passed=!report.execution_error &amp;&amp; report.scenarios.length===4 &amp;&amp; report.scenarios.every(s=&gt;s.baseline_matches_expected);</code> | Mark phase1_passed only if no execution error and all four baseline results match. This flag means the fixture/check setup behaved as intended, not that all feature/defect assertions passed. |
| [216](/C:/AI_employee/trusted_checks/phase1.mjs:216) | <code>  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));</code> | Write the complete pretty-printed report into this run directory. |
| [217](/C:/AI_employee/trusted_checks/phase1.mjs:217) | <code>  await writeFile(join(root,'var','evidence','latest.json'),JSON.stringify({run_id:runId,report:join(output,'report.json'),phase1_passed:report.phase1_passed},null,2));</code> | Write latest.json as a pointer to this report; older reports remain on disk. |
| [218](/C:/AI_employee/trusted_checks/phase1.mjs:218) | <code>  console.log(`Evidence: ${output}`);</code> | Print evidence location. |
| [219](/C:/AI_employee/trusted_checks/phase1.mjs:219) | <code>  console.log(`Phase 1 checks: ${report.phase1_passed?'PASS (including recorded expected defects)':'FAIL'}`);</code> | Print the overall setup verdict, explicitly mentioning recorded expected defects. |
| [220](/C:/AI_employee/trusted_checks/phase1.mjs:220) | <code>  process.exitCode=report.phase1_passed?0:1;</code> | Set process exit code 0 or 1 from that verdict. |
| [221](/C:/AI_employee/trusted_checks/phase1.mjs:221) | <code>}</code> | Close the suite's finally block. |

### tools/package.json

[Open actual file](/C:/AI_employee/tools/package.json) · 12 lines · snapshot SHA256: ec01310159ea7a4b454ec9f572bf280f1edd9500a7fa2aceba31ab803a6d0a58

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/tools/package.json:1) | <code>{</code> | Start the npm package manifest object. |
| [2](/C:/AI_employee/tools/package.json:2) | <code>  "name": "devdesk-trusted-checks",</code> | Give this private developer-tool package its name. |
| [3](/C:/AI_employee/tools/package.json:3) | <code>  "private": true,</code> | Prevent accidental npm publication with private=true. |
| [4](/C:/AI_employee/tools/package.json:4) | <code>  "type": "module",</code> | Use JavaScript ES-module semantics, matching the evaluator's import syntax. |
| [5](/C:/AI_employee/tools/package.json:5) | <code>  "description": "Local developer browser checks outside the repairable playground",</code> | Describe the package's purpose; this text does not configure a security boundary. |
| [6](/C:/AI_employee/tools/package.json:6) | <code>  "scripts": {</code> | Begin npm scripts. |
| [7](/C:/AI_employee/tools/package.json:7) | <code>    "check:phase1": "node ../trusted_checks/phase1.mjs"</code> | Define npm run check:phase1 to execute the evaluator one directory above tools. This relative path assumes npm executes the script from tools. |
| [8](/C:/AI_employee/tools/package.json:8) | <code>  },</code> | Close scripts. |
| [9](/C:/AI_employee/tools/package.json:9) | <code>  "devDependencies": {</code> | Begin development dependencies; these are tooling, not C++ runtime libraries. |
| [10](/C:/AI_employee/tools/package.json:10) | <code>    "playwright": "1.64.0"</code> | Pin Playwright exactly to 1.64.0 without a floating caret/tilde version range. |
| [11](/C:/AI_employee/tools/package.json:11) | <code>  }</code> | Close development dependencies. |
| [12](/C:/AI_employee/tools/package.json:12) | <code>}</code> | Close the manifest. |

### tools/package-lock.json

[Open actual file](/C:/AI_employee/tools/package-lock.json) · 42 lines · snapshot SHA256: b7e8098641d1abe580323049d27555310077380bdf15f5599b993c61bb2ca648

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/tools/package-lock.json:1) | <code>{</code> | Start npm's generated lockfile object; change dependencies through npm rather than manually editing this file. |
| [2](/C:/AI_employee/tools/package-lock.json:2) | <code>  "name": "devdesk-trusted-checks",</code> | Record the root package name. |
| [3](/C:/AI_employee/tools/package-lock.json:3) | <code>  "lockfileVersion": 3,</code> | Declare npm lockfile format version 3. |
| [4](/C:/AI_employee/tools/package-lock.json:4) | <code>  "requires": true,</code> | Record that dependencies are described by this lockfile. |
| [5](/C:/AI_employee/tools/package-lock.json:5) | <code>  "packages": {</code> | Start entries for root and installed package paths. |
| [6](/C:/AI_employee/tools/package-lock.json:6) | <code>    "": {</code> | Start the root package entry, represented by empty path. |
| [7](/C:/AI_employee/tools/package-lock.json:7) | <code>      "name": "devdesk-trusted-checks",</code> | Repeat its package name. |
| [8](/C:/AI_employee/tools/package-lock.json:8) | <code>      "devDependencies": {</code> | Record root development dependency declarations. |
| [9](/C:/AI_employee/tools/package-lock.json:9) | <code>        "playwright": "1.64.0"</code> | Record the exact Playwright version. |
| [10](/C:/AI_employee/tools/package-lock.json:10) | <code>      }</code> | Close root development dependencies. |
| [11](/C:/AI_employee/tools/package-lock.json:11) | <code>    },</code> | Close root package entry. |
| [12](/C:/AI_employee/tools/package-lock.json:12) | <code>    "node_modules/playwright": {</code> | Start the installed Playwright package record. |
| [13](/C:/AI_employee/tools/package-lock.json:13) | <code>      "version": "1.64.0",</code> | Pin its installed version. |
| [14](/C:/AI_employee/tools/package-lock.json:14) | <code>      "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.64.0.tgz",</code> | Record its registry download URL; this is dependency provenance, not an app URL. |
| [15](/C:/AI_employee/tools/package-lock.json:15) | <code>      "integrity": "sha512-kVzTnYFYEyQ9RGzBjNCd2+yEqWmVbxl3AHPynv3qQ6JTjv4a+kwRcnqQwIpuP3NnrnIrE/Q6wWAIAvMfIE2/Yg==",</code> | Record npm's integrity digest for the downloaded package tarball. It detects mismatched bytes, not all possible malicious package behavior. |
| [16](/C:/AI_employee/tools/package-lock.json:16) | <code>      "dev": true,</code> | Mark it as a development dependency. |
| [17](/C:/AI_employee/tools/package-lock.json:17) | <code>      "license": "Apache-2.0",</code> | Record its license identifier. |
| [18](/C:/AI_employee/tools/package-lock.json:18) | <code>      "dependencies": {</code> | Begin its runtime dependency list. |
| [19](/C:/AI_employee/tools/package-lock.json:19) | <code>        "playwright-core": "1.64.0"</code> | Pin playwright-core to the same exact version. |
| [20](/C:/AI_employee/tools/package-lock.json:20) | <code>      },</code> | Close dependency list. |
| [21](/C:/AI_employee/tools/package-lock.json:21) | <code>      "bin": {</code> | Begin command-line executable mappings. |
| [22](/C:/AI_employee/tools/package-lock.json:22) | <code>        "playwright": "cli.js"</code> | Map the playwright command to cli.js in that package. |
| [23](/C:/AI_employee/tools/package-lock.json:23) | <code>      },</code> | Close executable mappings. |
| [24](/C:/AI_employee/tools/package-lock.json:24) | <code>      "engines": {</code> | Begin its supported runtime declaration. |
| [25](/C:/AI_employee/tools/package-lock.json:25) | <code>        "node": "&gt;=20"</code> | Declare Node &gt;=20; observed Node 24.11.1 satisfies this. |
| [26](/C:/AI_employee/tools/package-lock.json:26) | <code>      }</code> | Close engines. |
| [27](/C:/AI_employee/tools/package-lock.json:27) | <code>    },</code> | Close Playwright package record. |
| [28](/C:/AI_employee/tools/package-lock.json:28) | <code>    "node_modules/playwright-core": {</code> | Start playwright-core's installed package record. |
| [29](/C:/AI_employee/tools/package-lock.json:29) | <code>      "version": "1.64.0",</code> | Pin its version. |
| [30](/C:/AI_employee/tools/package-lock.json:30) | <code>      "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.64.0.tgz",</code> | Record its registry tarball URL. |
| [31](/C:/AI_employee/tools/package-lock.json:31) | <code>      "integrity": "sha512-T9r+MZkTECl2+oUcZ26YgZzTrYidTsIhYYkJix+6iDOymOb1FB2RLLSOxRGnZGv5DStt+aduIVbt+E8WygXYpg==",</code> | Record that tarball's integrity digest. |
| [32](/C:/AI_employee/tools/package-lock.json:32) | <code>      "dev": true,</code> | Mark it as a development dependency. |
| [33](/C:/AI_employee/tools/package-lock.json:33) | <code>      "license": "Apache-2.0",</code> | Record its license identifier. |
| [34](/C:/AI_employee/tools/package-lock.json:34) | <code>      "bin": {</code> | Begin its command mappings. |
| [35](/C:/AI_employee/tools/package-lock.json:35) | <code>        "playwright-core": "cli.js"</code> | Map playwright-core to its cli.js. |
| [36](/C:/AI_employee/tools/package-lock.json:36) | <code>      },</code> | Close command mappings. |
| [37](/C:/AI_employee/tools/package-lock.json:37) | <code>      "engines": {</code> | Begin Node version requirement. |
| [38](/C:/AI_employee/tools/package-lock.json:38) | <code>        "node": "&gt;=20"</code> | Declare Node &gt;=20 for the core package too. |
| [39](/C:/AI_employee/tools/package-lock.json:39) | <code>      }</code> | Close engines. |
| [40](/C:/AI_employee/tools/package-lock.json:40) | <code>    }</code> | Close core package record. |
| [41](/C:/AI_employee/tools/package-lock.json:41) | <code>  }</code> | Close the packages map. |
| [42](/C:/AI_employee/tools/package-lock.json:42) | <code>}</code> | Close the generated lockfile. |

### .gitignore

[Open actual file](/C:/AI_employee/.gitignore) · 5 lines · snapshot SHA256: d8a0b22ce26e044c32f9fd78a17e8fcf836008b057e3811b1f3c6506d2058f7e

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/.gitignore:1) | <code>var/</code> | Ignore generated var runtime data, worktree folders, evidence and scratch files if/when this parent workspace is tracked in Git. Currently playground is the separate initialized repository. |
| [2](/C:/AI_employee/.gitignore:2) | <code>node_modules/</code> | Ignore installed node_modules dependency directories in a tracked parent workspace. |
| [3](/C:/AI_employee/.gitignore:3) | <code>.env</code> | Ignore a local .env credential/config file. |
| [4](/C:/AI_employee/.gitignore:4) | <code>.env.*</code> | Ignore related .env.* files too. |
| [5](/C:/AI_employee/.gitignore:5) | <code>!.env.example</code> | Permit an example template named .env.example to be tracked. This root rule does not automatically apply to the separate playground repository. |

### playground/.gitignore

[Open actual file](/C:/AI_employee/playground/.gitignore) · 5 lines · snapshot SHA256: c539795492d29943897bf9e8e0977d3afb39e669b12d0d598d3f7d8915dbcd06

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/.gitignore:1) | <code>build/</code> | Ignore generated builds within playground/fixture repositories; rebuild them from tracked source. |
| [2](/C:/AI_employee/playground/.gitignore:2) | <code>*.db</code> | Ignore SQLite database files if accidentally placed under the source tree. |
| [3](/C:/AI_employee/playground/.gitignore:3) | <code>*.db-shm</code> | Ignore SQLite shared-memory sidecars. |
| [4](/C:/AI_employee/playground/.gitignore:4) | <code>*.db-wal</code> | Ignore SQLite write-ahead-log sidecars. |
| [5](/C:/AI_employee/playground/.gitignore:5) | <code>.env</code> | Ignore a local .env file in this repository; actual Phase 1 tasks do not need API credentials. |

### playground/build/build_identity.hpp

[Open actual file](/C:/AI_employee/playground/build/build_identity.hpp) · 2 lines · snapshot SHA256: 2f25ab4a13cde67c45aeb0b1db9e64570461964483021cfd3b52ebd85fd2c1dc

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/build/build_identity.hpp:1) | <code>#define PLAYGROUND_COMMIT "a23112f3c050f1c948ddc758e667f0c6d23540ee"</code> | Define the source HEAD commit embedded into the executable's health JSON. With uncommitted edits HEAD stays the same; the build digest captures their file contents separately. |
| [2](/C:/AI_employee/playground/build/build_identity.hpp:2) | <code>#define PLAYGROUND_BUILD "57617c56caae486a94d5e15d7a8f1d0b95cb546608f373976ec1414350d96c94"</code> | Define the aggregate source/static/vendor byte digest embedded into the executable. A new build overwrites this generated file; do not hand-edit it. |

### playground/build/unity.cpp

[Open actual file](/C:/AI_employee/playground/build/unity.cpp) · 3 lines · snapshot SHA256: b45549b9ffd122bd196e3894cfa7a224d1d4ce44d320cd46c2190e688ead2ff3

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/build/unity.cpp:1) | <code>#include "C:/AI_employee/playground/src/main.cpp"</code> | Include the actual main.cpp implementation into the generated single compilation unit. |
| [2](/C:/AI_employee/playground/build/unity.cpp:2) | <code>#include "C:/AI_employee/playground/src/routes.cpp"</code> | Include route implementation into that same unit, with header guards avoiding repeat library definitions. |
| [3](/C:/AI_employee/playground/build/unity.cpp:3) | <code>#include "C:/AI_employee/playground/src/task_repository.cpp"</code> | Include repository implementation into that same unit. This simple build technique suits this small app; unrelated anonymous helpers must avoid collisions as the code grows. |

### playground/build/build-info.json

[Open actual file](/C:/AI_employee/playground/build/build-info.json) · 6 lines · snapshot SHA256: 74944a2949249b360aca862de65406f8971f1394e0faac435ad620ff0a0297bc

| Line | Actual code | Explanation |
| --- | --- | --- |
| [1](/C:/AI_employee/playground/build/build-info.json:1) | <code>﻿{</code> | Start generated build metadata. |
| [2](/C:/AI_employee/playground/build/build-info.json:2) | <code>    "commit":  "a23112f3c050f1c948ddc758e667f0c6d23540ee",</code> | Record the Git HEAD commit used at build time. |
| [3](/C:/AI_employee/playground/build/build-info.json:3) | <code>    "build":  "57617c56caae486a94d5e15d7a8f1d0b95cb546608f373976ec1414350d96c94",</code> | Record the actual selected source/static/vendor file-byte digest; Windows line-ending differences can produce different digests for the same commit across worktrees. |
| [4](/C:/AI_employee/playground/build/build-info.json:4) | <code>    "compiler":  "16.2.0",</code> | Record the compiler version observed by this build invocation. |
| [5](/C:/AI_employee/playground/build/build-info.json:5) | <code>    "built_at":  "2026-10-10T15:55:13.8595819Z"</code> | Record its UTC build timestamp; this is not a task's created_at or a fresh verification timestamp. |
| [6](/C:/AI_employee/playground/build/build-info.json:6) | <code>}</code> | Close generated build metadata. |

## 9. Fixture-specific lines

### Backend repository

All lines in [backend task_repository.cpp](/C:/AI_employee/var/fixtures/backend/src/task_repository.cpp) reuse the repository explanations above except line 60. Verified against normalized newline text in this snapshot.

| Line | Actual code | Explanation |
| --- | --- | --- |
| [60](/C:/AI_employee/var/fixtures/backend/src/task_repository.cpp:60) | <code>    const char* sql = "SELECT id,title,description,status,created_at FROM tasks WHERE (?1 = '' OR status = ?1 OR ?1 = 'todo') ORDER BY id;";</code> | Added OR ?1 = 'todo' is true for every row when the requested filter is todo; done/in_progress still use row equality. See the truth table and manual exercise above. |

### Frontend CSS

The first 59 lines in [frontend styles.css](/C:/AI_employee/var/fixtures/frontend/static/styles.css) reuse the clean CSS explanations. These three lines are appended:

| Line | Actual code | Explanation |
| --- | --- | --- |
| [60](/C:/AI_employee/var/fixtures/frontend/static/styles.css:60) | <code>(blank)</code> | Blank separator before the seeded fixture addition. |
| [61](/C:/AI_employee/var/fixtures/frontend/static/styles.css:61) | <code>/* Developer-seeded mobile action overlap fixture. */</code> | Comment labels this as a deliberately introduced source defect. |
| [62](/C:/AI_employee/var/fixtures/frontend/static/styles.css:62) | <code>@media (max-width: 640px) { .task-actions { position: relative; min-height: 50px; } .task-actions button { width: 145px; } .task-actions .remove { position: absolute; left: 105px; top: 14px; } }</code> | At &lt;=640px: the action group is relative and at least 50px tall, both controls are 145px wide, and Remove is absolutely placed left=105px/top=14px. Its horizontal interval intersects the first button by 40px. Absolute positioning removes it from normal flex placement; desktop does not use this media rule. |

All other listed C++/frontend fixture sources were checked for equality after newline normalization. Feature uses the clean source, with its Completed control absent. Fixture build_identity.hpp, unity.cpp and build-info.json have different values/paths but the same generated-line roles; do not duplicate-edit generated files.

## 10. What was checked for this explanation

Source inspection and annotation coverage ran on 11 October 2026: 19 base/config/generated files, 905 physical lines, plus the verified backend override and three frontend additions. The generator rejects any unexplained nonblank source line or unexpected fixture difference. Application and fixture source were not edited. No new product tests or servers were run for this documentation-only request. Prior Phase 1 evidence is still the 10 October report under var/evidence/2026-10-10T15-55-30-050Z-45764: 169 PASS, 7 retained expected FAIL, 4/4 baseline matches. That is evidence of developer baseline checks, not autonomous repair success.

Phase 2 remains paused. Your task is to reproduce the observed backend behavior, explain the predicate, and perform the isolated learning edit yourself.
