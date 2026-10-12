#include "worker.hpp"
#include <windows.h>
#include <chrono>
#include "reliability.hpp"
#include <iostream>
namespace devdesk {
namespace {
struct Kernel {
    HANDLE handle = nullptr;
    ~Kernel() {
        if (handle && handle != INVALID_HANDLE_VALUE)
            CloseHandle(handle);
    }
};
std::string file_text(const std::filesystem::path &path, size_t maximum = 100000) {
    std::ifstream stream(path, std::ios::binary);
    if (!stream)
        throw Error(503, "Trusted worker file unavailable");
    std::string out((std::istreambuf_iterator<char>(stream)), {});
    if (out.size() > maximum)
        throw Error(400, "Worker file exceeds limit");
    return out;
}
void save_json(const std::filesystem::path &path, const Json &value) {
    std::ofstream stream(path);
    stream << value.dump();
    stream.close();
    if (!stream)
        throw Error(503, "Worker checkpoint file write failed");
}
std::wstring quoted(const std::wstring &value) {
    std::wstring result = L"\"";
    unsigned slashes = 0;
    for (wchar_t c : value) {
        if (c == L'\\') {
            ++slashes;
            continue;
        }
        if (c == L'\"') {
            result.append(slashes * 2 + 1, L'\\');
            result += c;
        } else {
            result.append(slashes, L'\\');
            result += c;
        }
        slashes = 0;
    }
    result.append(slashes * 2, L'\\');
    return result + L"\"";
}
Json helper(const std::filesystem::path &root, const std::filesystem::path &directory,
            const Json &job, const std::string &script = "investigation-helper.mjs",
            DWORD timeout = 25000) {
    std::filesystem::create_directories(directory);
    const auto input = directory / "input.json", output = directory / "output.json";
    save_json(input, job);
    // A fixed executable and script: action data is read as JSON, never shell text.
    const std::wstring exe = L"C:\\Program Files\\nodejs\\node.exe";
    auto command = quoted(exe) + L" " + quoted((root / script).wstring()) + L" " +
                   quoted(input.wstring()) + L" " + quoted(output.wstring());
    Kernel group;
    group.handle = CreateJobObjectW(nullptr, nullptr);
    if (!group.handle)
        throw Error(503, "Helper job creation failed");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
                                              JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
                                              JOB_OBJECT_LIMIT_JOB_MEMORY;
    limits.BasicLimitInformation.ActiveProcessLimit = 24;
    limits.JobMemoryLimit = 768ULL * 1024 * 1024;
    if (!SetInformationJobObject(group.handle, JobObjectExtendedLimitInformation, &limits,
                                 sizeof limits))
        throw Error(503, "Helper resource limits failed");
    wchar_t windows[MAX_PATH];
    GetWindowsDirectoryW(windows, MAX_PATH);
    // Chrome needs the Windows profile path for platform initialization. Browser data still
    // lives in a fresh job-local TEMP directory. Copy only OS metadata, never host secrets.
    wchar_t profile[32768];
    if (!GetEnvironmentVariableW(L"USERPROFILE", profile, 32768))
        throw Error(503, "Windows profile path unavailable for browser initialization");
    std::wstring environment = L"SystemRoot=" + std::wstring(windows) + L'\0' + L"TEMP=" +
                               directory.wstring() + L'\0' + L"TMP=" + directory.wstring() + L'\0' +
                               L"USERPROFILE=" + std::wstring(profile) + L'\0';
    environment += L'\0';
    STARTUPINFOW start{};
    start.cb = sizeof start;
    SECURITY_ATTRIBUTES inherit{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
    Kernel log, null_input;
    log.handle = CreateFileW((directory / "helper.log").c_str(), GENERIC_WRITE, FILE_SHARE_READ,
                             &inherit, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    null_input.handle = CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                    &inherit, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (log.handle == INVALID_HANDLE_VALUE || null_input.handle == INVALID_HANDLE_VALUE)
        throw Error(503, "Helper diagnostic handles unavailable");
    start.dwFlags = STARTF_USESTDHANDLES;
    start.hStdInput = null_input.handle;
    start.hStdOutput = log.handle;
    start.hStdError = log.handle;
    PROCESS_INFORMATION child{};
    if (!CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, TRUE,
                        CREATE_NO_WINDOW | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT,
                        environment.data(), directory.wstring().c_str(), &start, &child))
        throw Error(503, "Helper startup failed");
    Kernel process, thread;
    process.handle = child.hProcess;
    thread.handle = child.hThread;
    if (!AssignProcessToJobObject(group.handle, process.handle)) {
        TerminateProcess(process.handle, 1);
        throw Error(503, "Helper containment assignment failed");
    }
    ResumeThread(thread.handle);
    const auto waited = WaitForSingleObject(process.handle, timeout);
    if (waited != WAIT_OBJECT_0) {
        TerminateJobObject(group.handle, 1);
        WaitForSingleObject(process.handle, 2000);
        throw Error(504, "Read-only helper timed out; process group stopped");
    }
    auto result = Json::parse(file_text(output));
    if (!result.value("ok", false))
        throw Error(422, result.value("error", std::string("Read-only observation unavailable")));
    return result.at("result");
}
std::string base64(const std::string &bytes) {
    const char *table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    unsigned value = 0;
    int bits = -6;
    for (unsigned char c : bytes) {
        value = (value << 8) | c;
        bits += 8;
        while (bits >= 0) {
            out += table[(value >> bits) & 63];
            bits -= 6;
        }
    }
    if (bits > -6)
        out += table[((value << 8) >> (bits + 8)) & 63];
    while (out.size() % 4)
        out += '=';
    return out;
}
void event(Database &db, const std::string &ticket, const std::string &type,
           const std::string &message) {
    db.query("INSERT INTO events(ticket_id,actor_kind,type,message) VALUES($1,'worker',$2,$3)",
             {ticket, type, message});
}
Json default_action(const std::string &tool) {
    return {{"tool", tool},  {"path", ""},      {"query", ""},
            {"status", ""},  {"start_line", 1}, {"limit", 80},
            {"verdict", ""}, {"summary", ""},   {"evidence_ids", Json::array()}};
}
} // namespace
Json repair_helper(const std::filesystem::path &release, const std::filesystem::path &directory,
                   const Json &job) {
    return helper(release, directory, job, "repair-helper.mjs", 200000);
}
int run_worker(Database &db, const Json &runtime, const Json &model,
               const std::filesystem::path &root, bool test_mode) {
    wchar_t executable[MAX_PATH];
    if (!GetModuleFileNameW(nullptr, executable, MAX_PATH))
        throw Error(403, "Worker executable identity unavailable");
    const auto release = std::filesystem::path(executable).parent_path();
    if (std::filesystem::canonical(release.parent_path()) !=
        std::filesystem::canonical(root / "devdesk/build/releases"))
        throw Error(403, "Worker root must be the protected executable workspace");
    const auto provider = model.value("provider", std::string());
    if (test_mode) {
        if (provider != "scripted_test" || !std::regex_match(runtime.value("schema", std::string()),
                                                             std::regex("test_[a-f0-9]{32}")))
            throw Error(
                403, "Scripted adapter allowed only by explicit test mode in a fresh test schema");
    } else if ((provider != "openai" && provider != "gemini") ||
               model.value("api_key", std::string()).empty())
        throw Error(503, "Live model access is not configured in ignored var/config/model.json; "
                         "queue left unchanged");
    const int actions = model.value("max_actions", 12), calls = model.value("max_calls", 12),
              seconds = model.value("max_seconds", 300), tokens = model.value("max_tokens", 200000);
    const double max_cost = model.value("max_usd", 0.5),
                 input_price = model.value("input_usd_per_million", 0.4),
                 output_price = model.value("output_usd_per_million", 1.6);
    if (actions < 1 || actions > 12 || calls < 1 || calls > 12 || seconds < 30 || seconds > 600 ||
        tokens < 4000 || tokens > 500000 || max_cost <= 0 || max_cost > 2 || input_price < 0 ||
        output_price < 0)
        throw Error(400, "Invalid trusted worker budget configuration");
    auto locked = db.query("SELECT pg_try_advisory_lock(hashtext(current_schema()),1) AS locked");
    if (locked.get(0, "locked") != "t") {
        std::cout << "Another read-only investigator owns this project's capacity.\n";
        return 2;
    }
    WorkerLease lease(db,runtime,root,"investigation");
    reconcile_work(db,root);
    // No active owner remains if this connection acquired the project lock. Interrupted calls are
    // NOT replayed.
    {
        Transaction tx(db);
        auto stale =
            db.query("UPDATE investigation_runs SET "
                     "state='INTERRUPTED',verdict='needs_information',summary='Worker stopped "
                     "before a durable conclusion; provider effects may be uncertain. No automatic "
                     "replay.',finished_at=now() WHERE state='RUNNING' RETURNING ticket_id");
        for (int i = 0; i < stale.rows(); ++i) {
            const auto id = stale.get(i, "ticket_id");
            db.query("UPDATE tickets SET state='NEEDS_INFORMATION' WHERE id=$1", {id});
            db.query("UPDATE investigations SET state='needs_information',confirmed=false WHERE "
                     "id=(SELECT investigation_id FROM tickets WHERE id=$1)",
                     {id});
            event(db, id, "investigation_interrupted",
                  "Interrupted read-only investigation retained; no automatic model-call replay.");
        }
        tx.commit();
    }
    const auto run = random_hex(16);
    Json report;
    std::string ticket_id;
    {
        Transaction tx(db);
        auto next = db.query(
            "SELECT t.id AS ticket_id,r.* FROM tickets t JOIN requests r ON r.id=t.request_id JOIN "
            "employees e ON e.id=r.employee_id WHERE t.state='QUEUED' AND r.project_id=1 AND "
            "e.active ORDER BY t.priority,t.created_at,t.id LIMIT 1 FOR UPDATE OF t SKIP LOCKED");
        if (!next.rows()) {
            tx.commit();
            std::cout << "No queued investigation.\n";
            return 0;
        }
        report = next.json()[0];
        ticket_id = report.at("ticket_id");
        const auto identity = read_json(release / "build-info.json");
        db.query("INSERT INTO "
                 "investigation_runs(id,ticket_id,mode,state,model,prompt_version,worker_build) "
                 "VALUES($1,$2,$3,'RUNNING',$4,'investigation-v7',$5)",
                 {run, ticket_id, test_mode ? "scripted_test" : "live",
                  test_mode ? "scripted-test-v1" : model.at("model").get<std::string>(),
                  identity.at("build")});
        db.query("UPDATE tickets SET state='INVESTIGATING' WHERE id=$1", {ticket_id});
        lease.attach("investigation_runs",run);
        db.query("UPDATE investigations SET state='running' WHERE id=(SELECT investigation_id FROM "
                 "tickets WHERE id=$1)",
                 {ticket_id});
        event(db, ticket_id, "investigation_started",
              test_mode ? "SCRIPTED TEST investigation started; zero live model calls."
                        : "Read-only model investigation started. No source-edit authority.");
        tx.commit();
    }
    int input_total = 0, output_total = 0, call_total = 0;
    double cost = 0;
    Json observations = Json::array();
    const auto begun = std::chrono::steady_clock::now();
    auto complete = [&](const std::string &verdict, const std::string &summary) {
        lease.ensure(ticket_id,true);
        const bool cancelled=cancellation_requested(db,ticket_id);
        const bool confirmed = verdict == "reproduced" && report.at("kind") == "bug";
        const bool needs = verdict == "needs_information";
        Transaction tx(db);
        db.query("UPDATE investigation_runs SET "
                 "state=$2,verdict=$3,summary=$4,model_calls=$5,input_tokens=$6,output_tokens=$7,"
                 "estimated_usd=$8,finished_at=now() WHERE id=$1",
                 {run, cancelled?"CANCELLED":needs ? "NEEDS_INFORMATION" : "FINISHED", cancelled?"needs_information":verdict, summary,
                  std::to_string(call_total), std::to_string(input_total),
                  std::to_string(output_total), std::to_string(cost)});
        db.query("UPDATE tickets SET state=$2 WHERE id=$1",
                 {ticket_id, cancelled?"CANCELLED":needs ? "NEEDS_INFORMATION" : "INVESTIGATED_READ_ONLY"});
        db.query("UPDATE investigations SET state=$2,confirmed=$3 WHERE id=(SELECT "
                 "investigation_id FROM tickets WHERE id=$1)",
                 {ticket_id, cancelled?"cancelled":verdict, confirmed&&!cancelled ? "true" : "false"});
        event(db, ticket_id, "investigation_finished",
              (test_mode ? "SCRIPTED TEST: " : "") + std::string("Read-only assessment: ") +
                  verdict + ". No source change or repair claimed.");
        db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) "
                 "VALUES($1,$2,$3,$4)",
                 {report.at("employee_id"), ticket_id, "investigation:" + run,
                  (test_mode ? "SCRIPTED TEST: " : "") + std::string("Investigation recorded: ") +
                      verdict + ". Review evidence; no repair performed."});
        tx.commit();
    };
    try {
        const auto url = report.at("page_url").get<std::string>();
        std::smatch origin_match;
        if (!std::regex_search(url, origin_match,
                               std::regex(R"(^http://127\.0\.0\.1:808([0-3])(?:/|$))")))
            throw Error(403, "Reported origin is not registered");
        const int scenario = std::stoi(origin_match[1]);
        const auto source = scenario == 0 ? root / "playground"
                                          : root / "var/fixtures" /
                                                std::vector<std::string>{"", "frontend", "backend",
                                                                         "feature"}[scenario];
        const auto origin = "http://127.0.0.1:808" + std::to_string(scenario);
        const auto directory = root / "var/worker" / run;
        Json job = {{"workspace_root", root.string()},
                    {"source_root", source.string()},
                    {"origin", origin},
                    {"page_url", url},
                    {"git_exe", "C:/Program Files/Git/cmd/git.exe"},
                    {"chrome_exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"},
                    {"width", std::stoi(report.at("viewport_width").get<std::string>())},
                    {"height", std::stoi(report.at("viewport_height").get<std::string>())},
                    {"action", default_action("identity")}};
        lease.bind_job(job,ticket_id);lease.ensure(ticket_id);
        const auto baseline = helper(release, directory / "baseline", job).at("identity");
        job["base_commit"] = baseline.at("commit");
        job["app_build"] = baseline.at("build");
        db.query("UPDATE investigation_runs SET base_commit=$2,app_build=$3 WHERE id=$1",
                 {run, baseline.at("commit"), baseline.at("build")});
        const auto instructions = file_text(release / "prompts/investigation.md", 8000);
        Json images = Json::array();
        auto set_image = [&](const std::string &id) {
            if (!model.value("vision", true) || test_mode)
                return;
            auto row = db.query("SELECT filename,mime,sha256 FROM uploads WHERE id=$1", {id});
            if (!row.rows())
                throw Error(404, "Evidence unavailable");
            const auto filename = row.get(0, "filename");
            if (!std::regex_match(filename, std::regex("[a-f0-9]{32}\\.(png|jpg)")))
                throw Error(403, "Stored evidence path invalid");
            const auto bytes = file_text(
                std::filesystem::path(runtime.at("uploads").get<std::string>()) / filename,
                5 * 1024 * 1024);
            if (hash(bytes) != row.get(0, "sha256"))
                throw Error(409, "Evidence bytes changed");
            images = Json::array({"data:" + row.get(0, "mime") + ";base64," + base64(bytes)});
        };
        if (!report.at("upload_id").is_null())
            set_image(report.at("upload_id"));
        Json public_report = report;
        public_report.erase("operation_key");
        public_report.erase("payload_hash");
        public_report.erase("employee_id");
        std::set<std::string> seen;
        for (int step = 1; step <= actions; ++step) {
            lease.ensure(ticket_id);
            if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() -
                                                                 begun)
                    .count() > seconds)
                throw Error(429, "Investigation wall-time budget exhausted");
            Json context = {{"report", public_report},
                            {"investigation_profile",scenario==2&&report.at("kind")=="bug"?"backend":scenario==3&&report.at("kind")=="feature"?"feature":"general"},
                            {"baseline", baseline},
                            {"observations", observations},
                            {"remaining_actions", actions - step + 1},
                            {"mode", test_mode ? "scripted_test" : "live"}};
            if (context.dump().size() > 40000)
                throw Error(429, "Investigation context budget exhausted");
            const int reserved_input =
                static_cast<int>(
                    context.dump().size() + instructions.size() +
                    (provider == "gemini" ? gemini_schema(context) : decision_schema(context))
                        .dump()
                        .size() +
                    1000) +
                (images.empty() ? 0 : 16384);
            const auto reserved_cost =
                reserved_input * input_price / 1000000 + 1536 * output_price / 1000000;
            if (call_total >= calls ||
                input_total + output_total + reserved_input + 1536 > tokens ||
                cost + reserved_cost > max_cost)
                throw Error(429, "Model-call/token/cost budget exhausted before next call");
            db.query("INSERT INTO decisions(run_id,step,state) VALUES($1,$2,'STARTED')",
                     {run, std::to_string(step)});
            const auto call_started = std::chrono::steady_clock::now();
            ModelReply decision;
            try {
                if (test_mode) {
                    const auto &scripted = model.at("actions");
                    if (static_cast<size_t>(step) > scripted.size())
                        throw Error(503, "Explicit scripted test actions exhausted");
                    decision.action = scripted[step - 1];
                    decision.request_id = "scripted-test-" + std::to_string(step);
                    for (auto &id : decision.action["evidence_ids"])
                        if (id == "$last")
                            id = observations.empty()
                                     ? std::string(32, '0')
                                     : observations.back().at("id").get<std::string>();
                } else {
                    ++call_total;
                    db.query("UPDATE investigation_runs SET model_calls=$2,usage_complete=false "
                             "WHERE id=$1",
                             {run, std::to_string(call_total)});
                    decision = model_decide(model, context, instructions, images);
                }
            } catch (...) {
                db.query("UPDATE decisions SET state='ERROR' WHERE run_id=$1 AND step=$2",
                         {run, std::to_string(step)});
                throw;
            }
            input_total += decision.input_tokens;
            output_total += decision.output_tokens;
            cost += decision.input_tokens * input_price / 1000000 +
                    decision.output_tokens * output_price / 1000000;
            const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                                     std::chrono::steady_clock::now() - call_started)
                                     .count();
            db.query("UPDATE decisions SET "
                     "state='RECEIVED',action=$3::jsonb,provider_request_id=$4,input_tokens=$5,"
                     "output_tokens=$6,duration_ms=$7 WHERE run_id=$1 AND step=$2",
                     {run, std::to_string(step), decision.action.dump(), decision.request_id,
                      std::to_string(decision.input_tokens), std::to_string(decision.output_tokens),
                      std::to_string(elapsed)});
            db.query(
                "UPDATE investigation_runs SET "
                "input_tokens=$2,output_tokens=$3,estimated_usd=$4,usage_complete=true WHERE id=$1",
                {run, std::to_string(input_total), std::to_string(output_total),
                 std::to_string(cost)});
            try {
                lease.ensure(ticket_id);validate_action(decision.action);
            } catch (...) {
                db.query("UPDATE decisions SET state='DENIED' WHERE run_id=$1 AND step=$2",
                         {run, std::to_string(step)});
                throw;
            }
            if (input_total + output_total > tokens || cost > max_cost)
                throw Error(429, "Observed model usage exhausted budget");
            const auto &action = decision.action;
            const std::string tool = action.at("tool");
            if (tool == "finish") {
                if (action.at("verdict") != "needs_information") {
                    bool instructions_seen = false, source_seen = false;
                    for (const auto &observation : observations) {
                        if (observation.at("result").contains("error"))
                            continue;
                        instructions_seen |= observation.at("tool") == "project_instructions";
                        source_seen |= observation.at("tool") == "source_read";
                    }
                    if (!instructions_seen || !source_seen)
                        throw Error(
                            422, "Conclusion requires trusted project context and a source read");
                }
                bool fail = false, pass = false;
                for (const auto &cited : action.at("evidence_ids")) {
                    bool found = false;
                    for (const auto &observation : observations)
                        if (observation.at("id") == cited) {
                            found = true;
                            for (const auto &assertion :
                                 observation.at("result").value("assertions", Json::array())) {
                                const auto name = assertion.value("name", std::string());
                                if(scenario==2&&report.at("kind")=="bug"&&name!="status_filter_exact")continue;
                                if(report.at("kind")=="feature"&&name!="completed_filter_present")continue;
                                if (report.at("kind") == "bug" &&
                                    name == "completed_filter_present")
                                    continue;
                                fail |= assertion.at("result") == "FAIL";
                                pass |= assertion.at("result") == "PASS";
                            }
                        }
                    if (!found)
                        throw Error(403, "Conclusion cited evidence outside this investigation");
                }
                const std::string verdict = action.at("verdict");
                if ((verdict == "reproduced" && !fail) ||
                    (verdict == "not_reproduced" && (!pass || fail)))
                    throw Error(422, "Conclusion is not supported by cited live assertions");
                // Revalidate build/source identity immediately before persisting a conclusion.
                job["action"] = default_action("identity");
                helper(release, directory / "final-identity", job);
                complete(verdict, action.at("summary"));
                std::cout << "Investigation " << run << " recorded: " << verdict
                          << (test_mode ? " (SCRIPTED TEST; zero live calls)" : " (live model)")
                          << ". No repair.\n";
                return 0;
            }
            auto effect = action;
            effect.erase("summary");
            const auto signature = effect.dump();
            if (!seen.insert(signature).second)
                throw Error(429, "Repeated unchanged action stopped");
            const auto evidence_id = random_hex(16);
            const auto screenshot_id = random_hex(16);
            const auto screenshot_path =
                std::filesystem::path(runtime.at("uploads").get<std::string>()) /
                (screenshot_id + ".png");
            std::filesystem::create_directories(screenshot_path.parent_path());
            job["action"] = action;
            job["screenshot_path"] = screenshot_path.string();
            Json result;
            try {
                if (tool == "project_instructions")
                    result = {{"text", file_text(release / "prompts/project.md", 8000)},
                              {"identity", baseline},
                              {"assertions", Json::array()}};
                else
                    result = helper(release, directory / std::to_string(step), job);
            } catch (const Error &e) {
                result = {{"error", e.what()},
                          {"identity", baseline},
                          {"assertions",
                           Json::array({{{"name", "tool_execution"}, {"result", "UNKNOWN"}}})}};
            }
            std::string upload_id;
            {
                Transaction tx(db);
                if (tool == "browser_observe" && !result.contains("error")) {
                    const auto bytes = file_text(screenshot_path, 5 * 1024 * 1024);
                    const auto image = decode_image(bytes);
                    db.query("INSERT INTO "
                             "uploads(id,employee_id,filename,mime,bytes,width,height,sha256) "
                             "VALUES($1,$2,$3,'image/png',$4,$5,$6,$7)",
                             {screenshot_id, report.at("employee_id"), screenshot_id + ".png",
                              std::to_string(bytes.size()), std::to_string(image.width),
                              std::to_string(image.height), hash(bytes)});
                    upload_id = screenshot_id;
                }
                db.query(
                    "INSERT INTO observations(id,run_id,step,tool,tool_version,result,upload_id) "
                    "VALUES($1,$2,$3,$4,'1',$5::jsonb,NULLIF($6,''))",
                    {evidence_id, run, std::to_string(step), tool, result.dump(), upload_id});
                event(db, ticket_id, "observation_recorded",
                      (test_mode ? "SCRIPTED TEST: " : "") + std::string("Read-only observation ") +
                          tool + " recorded as " + evidence_id + ".");
                tx.commit();
            }
            observations.push_back({{"id", evidence_id}, {"tool", tool}, {"result", result}});
            if (!upload_id.empty())
                set_image(upload_id);
        }
        throw Error(429, "Investigation action budget exhausted");
    } catch (const Error &e) {
        complete("needs_information", e.what());
        std::cout << "Investigation retained as needs_information: " << e.what() << "\n";
        return 3;
    } catch (const std::exception &) {
        complete("needs_information", "Investigation failed; details withheld to protect "
                                      "credentials. No repair or confirmation claimed.");
        std::cout << "Investigation retained as needs_information; no repair.\n";
        return 3;
    }
}
} // namespace devdesk
