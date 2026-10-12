#include "repair.hpp"
#include "reliability.hpp"
#include "consensus.hpp"
#include <windows.h>
#include <chrono>
#include <iostream>
namespace devdesk {
Json repair_schema() {
    Json properties = {
        {"tool",
         {{"type", "string"},
          {"enum", {"source_read", "replace_text", "diff", "run_checks", "finish"}}}},
        {"path", {{"type", "string"}}},
        {"before", {{"type", "string"}}},
        {"after", {{"type", "string"}}},
        {"verdict", {{"type", "string"}, {"enum", {"", "candidate_ready", "needs_information"}}}},
        {"summary", {{"type", "string"}}}};
    Json required = Json::array();
    for (auto it = properties.begin(); it != properties.end(); ++it)
        required.push_back(it.key());
    return {{"type", "object"},
            {"properties", properties},
            {"required", required},
            {"additionalProperties", false}};
}
Json repair_gemini_schema(bool execution_available, const std::string &profile) {
    Json branches = Json::array();
    const auto base = repair_schema();
    for (const auto &tool : base.at("properties").at("tool").at("enum")) {
        if (!execution_available && tool == "run_checks")
            continue;
        auto branch = base;
        auto &p = branch["properties"];
        p["tool"]["enum"] = Json::array({tool});
        if (!execution_available && tool == "finish")
            p["verdict"]["enum"] = Json::array({"needs_information"});
        for (const auto &field : {"path", "before", "after", "verdict"}) {
            const std::string f = field;
            const bool used = (f == "path" && (tool == "source_read" || tool == "replace_text")) ||
                              ((f == "before" || f == "after") && tool == "replace_text") ||
                              (f == "verdict" && tool == "finish");
            if (!used)
                p[f]["enum"] = Json::array({""});
            else if (f == "path")
                p[f]["enum"] = Json::array({repair_profile(profile).file});
        }
        branches.push_back(branch);
    }
    return {{"type", "object"},
            {"properties", {{"action", {{"anyOf", branches}}}}},
            {"required", Json::array({"action"})},
            {"additionalProperties", false}};
}
void validate_repair_action(const Json &a, const std::string &profile) {
    const auto schema = repair_schema();
    if (!a.is_object() || a.size() != 6)
        throw Error(400, "Invalid repair action fields");
    for (auto it = schema.at("properties").begin(); it != schema.at("properties").end(); ++it) {
        if (!a.contains(it.key()) || !a.at(it.key()).is_string() ||
            a.at(it.key()).get<std::string>().find('\0') != std::string::npos)
            throw Error(400, "Invalid repair action type");
        if (it.value().contains("enum") &&
            std::find(it.value().at("enum").begin(), it.value().at("enum").end(), a.at(it.key())) ==
                it.value().at("enum").end())
            throw Error(403, "Repair tool or verdict denied");
    }
    const std::string tool = a.at("tool");
    if (a.at("summary").get<std::string>().size() > 1500 ||
        a.at("before").get<std::string>().size() > 12000 ||
        a.at("after").get<std::string>().size() > 12000)
        throw Error(400, "Repair text exceeds limits");
    if (tool == "source_read" || tool == "replace_text") {
        if (a.at("path") != repair_profile(profile).file)
            throw Error(403, "File is outside approved repair scope");
    } else if (a.at("path") != "")
        throw Error(400, "Unexpected repair path");
    if (tool == "replace_text") {
        if (a.at("before") == "")
            throw Error(400, "Empty patch match");
    } else if (a.at("before") != "" || a.at("after") != "")
        throw Error(400, "Unexpected patch text");
    if (tool == "finish") {
        if (a.at("verdict") == "" || a.at("summary") == "")
            throw Error(400, "Conclusion needs summary/verdict");
    } else if (a.at("verdict") != "")
        throw Error(400, "Unexpected repair verdict");
}
int run_repair(Database &db, const Json &runtime, const Json &model,
               const std::filesystem::path &root, bool test_mode, bool patch_only) {
    wchar_t executable[MAX_PATH];
    if (!GetModuleFileNameW(nullptr, executable, MAX_PATH))
        throw Error(503, "Repair executable unavailable");
    const auto release = std::filesystem::path(executable).parent_path();
    if (std::filesystem::canonical(release.parent_path()) !=
        std::filesystem::canonical(root / "devdesk/build/releases"))
        throw Error(403, "Protected release required");
    if (test_mode) {
        if (model.value("provider", std::string()) != "scripted_test" ||
            !std::regex_match(runtime.value("schema", std::string()),
                              std::regex("test_[a-f0-9]{32}")))
            throw Error(403, "Repair test adapter requires explicit fresh test schema");
    } else if (model.value("provider", std::string()) != "gemini" &&
               model.value("provider", std::string()) != "openai")
        throw Error(400, "Unsupported repair provider");
    else if (model.value("api_key", std::string()).empty())
        throw Error(503, "Configure live access locally before repair claim");
    const auto runner_file = root / "var/config/runner.json";
    if (!patch_only &&
        (!std::filesystem::exists(runner_file) || !read_json(runner_file).value("verified", false)))
        throw Error(503, "Repair runner containment is unverified; queue unchanged");
    if (db.query("SELECT pg_try_advisory_lock(hashtext(current_schema()),1) AS locked")
            .get(0, "locked") != "t") {
        std::cout << "Project worker busy\n";
        return 0;
    }
    WorkerLease lease(db,runtime,root,"repair");reconcile_work(db,root);
    std::string run, ticket_id, proposal, base, scope, requester, profile;
    Json approved;
    {
        Transaction tx(db);
        auto row = db.query(
            "SELECT t.id,p.id AS "
            "proposal,p.base_commit,p.app_build,p.scope_hash,p.files,p.criteria,p.profile,r.employee_id FROM "
            "tickets t "
            "JOIN scope_proposals p ON p.ticket_id=t.id JOIN scope_approvals a ON "
            "a.proposal_id=p.id JOIN requests r ON r.id=t.request_id JOIN employees e ON "
            "e.id=r.employee_id WHERE t.state='READY' AND p.state='APPROVED' AND "
            "p.expires_at>now() AND a.scope_hash=p.scope_hash AND a.employee_id=r.employee_id AND "
            "e.active AND (p.profile<>'feature' OR EXISTS(SELECT 1 FROM feature_polls fp WHERE fp.proposal_id=p.id AND fp.state='PASSED' AND fp.scope_hash=p.scope_hash)) AND EXISTS(SELECT 1 FROM memberships m WHERE m.employee_id=r.employee_id AND "
            "m.project_id=r.project_id) ORDER BY t.priority,t.created_at,t.id FOR UPDATE OF t,p "
            "SKIP LOCKED LIMIT 1");
        if (!row.rows()) {
            tx.commit();
            std::cout << "No eligible approved repair\n";
            return 0;
        }
        ticket_id = row.get(0, "id");
        proposal = row.get(0, "proposal");
        base = row.get(0, "base_commit");
        scope = row.get(0, "scope_hash");
        requester = row.get(0, "employee_id");
        approved = row.json()[0];
        profile=row.get(0,"profile");repair_profile(profile);require_feature_consensus(db,proposal);
        if(profile=="feature"&&!patch_only&&!read_json(runner_file).value("feature_verified",false))throw Error(503,"Feature evaluator is unverified; queue unchanged");
        if(profile=="backend"&&!patch_only){const auto runner=read_json(runner_file);if(runner.value("version",std::string())!="phase7-runtime-v1"||!runner.value("backend_verified",false))throw Error(503,"Backend evaluator isolation is unverified; queue unchanged");}
        run = random_hex(16);
        db.query("INSERT INTO "
                 "repair_runs(id,ticket_id,proposal_id,mode,state,base_commit,model,worker_build) "
                 "VALUES($1,$2,$3,$4,'RUNNING',$5,$6,$7)",
                 {run, ticket_id, proposal, test_mode ? "scripted_test" : "live", base,
                  test_mode ? "scripted-test-v1" : model.at("model").get<std::string>(),
                  read_json(release / "build-info.json").at("build").get<std::string>()});
        db.query("UPDATE tickets SET state='IMPLEMENTING' WHERE id=$1", {ticket_id});
        lease.attach("repair_runs",run);
        db.query("UPDATE repair_runs SET scope_hash=$2,profile=$3 WHERE id=$1",{run,scope,profile});
        tx.commit();
    }
    int calls = 0, in = 0, out = 0, patches = 0;
    double cost = 0;
    bool checked = false, read = false, baseline_seen = patch_only;
    std::string checked_css;
    Json observations = Json::array();
    const auto start = std::chrono::steady_clock::now();
    auto complete = [&](const std::string &state, const std::string &summary,
                        const Json &candidate = Json::object()) {
        lease.ensure(ticket_id,true);const bool cancelled=cancellation_requested(db,ticket_id);
        Transaction tx(db);
        db.query(
            "UPDATE repair_runs SET "
            "state=$2,summary=$3,model_calls=$4,input_tokens=$5,output_tokens=$6,estimated_usd=$7,"
            "candidate_commit=$8,diff=$9,workspace=$10,finished_at=now() WHERE id=$1",
            {run, cancelled?"CANCELLED":state, summary, std::to_string(calls), std::to_string(in), std::to_string(out),
             std::to_string(cost), candidate.value("candidate_commit", std::string()),
             candidate.value("diff", std::string()), candidate.value("workspace", std::string())});
        db.query("UPDATE tickets SET state=$2 WHERE id=$1",
                 {ticket_id, cancelled?"CANCELLED":state == "CANDIDATE_READY" ? "CANDIDATE_READY" : "REPAIR_BLOCKED"});
        db.query("INSERT INTO events(ticket_id,actor_kind,type,message) "
                 "VALUES($1,'worker','repair_result',$2)",
                 {ticket_id, summary});
        db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) "
                 "VALUES($1,$2,$3,$4)",
                 {requester, ticket_id, "repair:" + run,
                  cancelled ? "Repair cancelled; existing evidence retained." : state == "CANDIDATE_READY"
                      ? "Isolated scoped candidate ready; not integrated or completed."
                      : "Repair blocked: " + summary});
        tx.commit();
    };
    try {
        Json job = {{"root", root.string()},
                    {"run_id", run},
                    {"base_commit", base},
                    {"app_build", approved.at("app_build")},
                    {"step", 0},
                    {"op", "create"},{"profile",profile}};
        lease.bind_job(job,ticket_id);lease.ensure(ticket_id);
        auto created = repair_helper(release, root / "var/repair-jobs" / run / "create", job);
        std::ifstream prompt_file(release / "prompts/repair.md");
        const std::string instructions((std::istreambuf_iterator<char>(prompt_file)), {});
        const double input_price = model.value("input_usd_per_million", 0.3),
                     output_price = model.value("output_usd_per_million", 2.5),
                     budget = model.value("max_usd", 0.5);
        if (budget <= 0 || budget > 2 || input_price < 0 || output_price < 0)
            throw Error(400, "Invalid repair budget");
        std::set<std::string> seen;
        for (int step = 1; step <= 12; ++step) {
            lease.ensure(ticket_id);
            if(!db.query("SELECT 1 FROM scope_proposals WHERE id=$1 AND profile=$2 AND files=$3::jsonb",{proposal,profile,Json::array({repair_profile(profile).file}).dump()}).rows())throw Error(409,"Approved profile or files changed");
            if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() -
                                                                 start)
                    .count() > 600)
                throw Error(429, "Repair elapsed budget exhausted");
            auto authority = db.query(
                "SELECT 1 FROM scope_proposals p JOIN scope_approvals a ON a.proposal_id=p.id JOIN "
                "employees e ON e.id=a.employee_id JOIN memberships m ON m.employee_id=e.id AND "
                "m.project_id=1 WHERE p.id=$1 AND p.scope_hash=$2 AND a.scope_hash=p.scope_hash "
                "AND p.expires_at>now() AND p.state='APPROVED' AND e.active",
                {proposal, scope});
            if (!authority.rows())
                throw Error(409, "Approval expired or authority changed");
            require_feature_consensus(db,proposal);
            Json context = {{"mode", "repair"},
                            {"profile",profile},
                            {"execution_available", !patch_only},
                            {"scope", approved},
                            {"observations", observations},
                            {"remaining_actions", 13 - step},
                            {"remaining_patches", 3 - patches}};
            if (context.dump().size() > 40000)
                throw Error(429, "Repair context budget exhausted");
            db.query("INSERT INTO repair_steps(run_id,step,state) VALUES($1,$2,'STARTED')",
                     {run, std::to_string(step)});
            Json action;
            if (test_mode) {
                if (static_cast<size_t>(step) > model.at("actions").size())
                    throw Error(429, "Scripted repair exhausted");
                action = model.at("actions")[step - 1];
            } else {
                const auto reserve = context.dump().size() + instructions.size() +
                                     repair_gemini_schema(!patch_only,profile).dump().size() + 1000;
                if (calls >= 12 || in + out + reserve + 1536 > 200000 ||
                    cost + reserve * input_price / 1000000 + 1536 * output_price / 1000000 > budget)
                    throw Error(429, "Repair model budget exhausted before call");
                ++calls;
                db.query("UPDATE repair_runs SET usage_complete=false,model_calls=$2 WHERE id=$1",
                         {run, std::to_string(calls)});
                const auto decision = model_decide(model, context, instructions, Json::array());
                action = decision.action;
                in += decision.input_tokens;
                out += decision.output_tokens;
                cost += decision.input_tokens * input_price / 1000000 +
                        decision.output_tokens * output_price / 1000000;
                db.query("UPDATE repair_runs SET "
                         "usage_complete=true,input_tokens=$2,output_tokens=$3,estimated_usd=$4 "
                         "WHERE id=$1",
                         {run, std::to_string(in), std::to_string(out), std::to_string(cost)});
            }
            db.query("UPDATE repair_steps SET state='RECEIVED',action=$3::jsonb WHERE run_id=$1 "
                     "AND step=$2",
                     {run, std::to_string(step), action.dump()});
            try {
                lease.ensure(ticket_id);validate_repair_action(action,profile);
            } catch (...) {
                db.query("UPDATE repair_steps SET state='DENIED' WHERE run_id=$1 AND step=$2",
                         {run, std::to_string(step)});
                throw;
            }
            if (cost > budget || in + out > 200000)
                throw Error(429, "Observed repair usage exhausted budget");
            if (!db.query("SELECT 1 FROM scope_proposals p JOIN scope_approvals a ON "
                          "a.proposal_id=p.id JOIN employees e ON e.id=a.employee_id JOIN "
                          "memberships m ON m.employee_id=e.id AND m.project_id=1 WHERE p.id=$1 "
                          "AND p.scope_hash=$2 AND a.scope_hash=p.scope_hash AND "
                          "p.expires_at>now() AND p.state='APPROVED' AND e.active",
                          {proposal, scope})
                     .rows())
                throw Error(409, "Approval expired or authority changed before tool execution");
            require_feature_consensus(db,proposal);
            const std::string tool = action.at("tool");
            auto signature = action;
            signature.erase("summary");
            if (tool != "source_read" && tool != "run_checks" &&
                !seen.insert(signature.dump()).second)
                throw Error(429, "Repeated unchanged repair action");
            if (tool == "finish") {
                if (patch_only && read && patches > 0 &&
                    action.at("verdict") == "needs_information") {
                    job["op"] = "diff";
                    job["step"] = step;
                    auto artifact = repair_helper(
                        release, root / "var/repair-jobs" / run / std::to_string(step), job);
                    complete("PATCH_ONLY",
                             "Unverified scoped patch stored; no candidate "
                             "build/check/commit/integration. " +
                                 action.at("summary").get<std::string>(),
                             artifact);
                    std::cout << "Unverified patch stored; execution unavailable.\n";
                    return 0;
                }
                if (action.at("verdict") != "candidate_ready" || !checked || !read || patches == 0)
                    throw Error(
                        422,
                        "Candidate requires source read, a patch and latest mandatory PASS checks");
                job["op"] = "commit";
                job["expected_css_hash"] = checked_css;job["expected_file_hash"]=checked_css;
                job["step"] = step;
                auto candidate = repair_helper(
                    release, root / "var/repair-jobs" / run / std::to_string(step), job);
                complete("CANDIDATE_READY", action.at("summary"), candidate);
                std::cout << "Isolated candidate ready; no integration.\n";
                return 0;
            }
            if (patch_only && tool == "run_checks")
                throw Error(403, "Patch-only mode forbids candidate execution");
            if (tool == "replace_text") {
                if (!read || !baseline_seen || ++patches > 3)
                    throw Error(403, "Read source and independently check baseline first; maximum "
                                     "three patches");
                checked = false;
            }
            job["op"] = tool;
            job["action"] = action;
            job["step"] = step;
            auto result =
                repair_helper(release, root / "var/repair-jobs" / run / std::to_string(step), job);
            if (tool == "source_read")
                read = true;
            if (tool == "run_checks") {
                checked_css = result.value("file_sha256",result.value("css_sha256", std::string()));
                if (patches == 0) {
                    for (const auto &assertion : result.at("report").at("checks"))
                        baseline_seen |= assertion.value("name", std::string()) ==
                                             repair_profile(profile).baseline_failure &&
                                         assertion.value("result", std::string()) == "FAIL";
                    if(profile=="backend"){bool seed=false,isolated=false;for(const auto &a:result.at("report").at("checks")){seed|=a.value("name",std::string())=="seed_matches_database"&&a.value("result",std::string())=="PASS";isolated|=a.value("name",std::string())=="evaluator_user_separated"&&a.value("result",std::string())=="PASS";}baseline_seen=baseline_seen&&seed&&isolated;}
                }
                checked =
                    result.value("exit_code", 1) == 0 && !result.at("report").at("checks").empty();
                std::set<std::string> observed;for(const auto &assertion:result.at("report").at("checks"))observed.insert(assertion.at("name").get<std::string>());
                checked=checked&&observed==mandatory_checks(profile)&&result.at("report").at("checks").size()==observed.size();
                for (const auto &assertion : result.at("report").at("checks"))
                    checked &= assertion.at("result") == "PASS";
            }
            db.query("UPDATE repair_steps SET state='OBSERVED',result=$3::jsonb WHERE run_id=$1 "
                     "AND step=$2",
                     {run, std::to_string(step), result.dump()});
            observations.push_back({{"tool", tool}, {"result", result}});
        }
        throw Error(429, "Repair action budget exhausted");
    } catch (const Error &e) {
        complete("BLOCKED", e.what());
        std::cout << "Repair blocked: " << e.what() << "\n";
        return 3;
    } catch (...) {
        complete("BLOCKED",
                 "Repair failed; inspect saved tool results. Provider details withheld.");
        return 3;
    }
}
int repair_selftest() {
    Json action = {{"tool", "source_read"}, {"path", "static/styles.css"},
                   {"before", ""},          {"after", ""},
                   {"verdict", ""},         {"summary", "Read approved CSS"}};
    validate_repair_action(action);
    int passed = 1;
    for (const auto &mutation : Json::array({{{"tool", "shell"}},
                                             {{"path", "../var/config/model.json"}},
                                             {{"path", "src/routes.cpp"}},
                                             {{"before", "unexpected"}},
                                             {{"verdict", "candidate_ready"}},
                                             {{"extra", "field"}}})) {
        auto invalid = action;
        invalid.update(mutation);
        bool denied = false;
        try {
            validate_repair_action(invalid);
        } catch (...) {
            denied = true;
        }
        if (!denied)
            return 1;
        ++passed;
    }
    if (repair_gemini_schema().at("properties").at("action").at("anyOf").size() != 5)
        return 1;
    ++passed;
    std::cout << "Repair schema/policy self-checks: " << passed << " PASS (offline)\n";
    auto backend=action;backend["path"]="src/task_repository.cpp";validate_repair_action(backend,"backend");
    bool denied=false;try{validate_repair_action(action,"backend");}catch(...){denied=true;}if(!denied||mandatory_checks("backend").size()!=26||repair_gemini_schema(true,"backend").at("properties").at("action").at("anyOf")[0].at("properties").at("path").at("enum")[0]!="src/task_repository.cpp")return 1;
    std::cout<<"Backend repair policy self-checks: 4 PASS (offline)\n";
    return 0;
}
} // namespace devdesk
