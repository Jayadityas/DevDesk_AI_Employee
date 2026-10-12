#include "support.hpp"
#include "consensus.hpp"
#include <chrono>
#include "integration.hpp"
#include "reliability.hpp"
#include <map>
#include <windows.h>
namespace devdesk {
namespace {
void reply(httplib::Response &res, const Json &json, int status = 200) {
    res.status = status;
    res.set_content(json.dump(), "application/json");
}
Json body(const httplib::Request &req, const std::set<std::string> &allowed) {
    if (req.get_header_value("Content-Type").find("application/json") != 0)
        throw Error(415, "Use application/json");
    if (req.body.size() > 16000)
        throw Error(413, "Report body is too large");
    auto value = Json::parse(req.body, nullptr, false);
    if (!value.is_object())
        throw Error(400, "Expected a JSON object");
    for (auto it = value.begin(); it != value.end(); ++it) {
        if (!allowed.contains(it.key()))
            throw Error(400, "Unknown field: " + it.key());
    }
    return value;
}
std::string text_field(const Json &value, const char *key, size_t maximum, bool required = true) {
    if (!value.contains(key)) {
        if (required)
            throw Error(400, std::string("Missing field: ") + key);
        return "";
    }
    if (!value.at(key).is_string())
        throw Error(400, std::string("Expected text: ") + key);
    auto text = value.at(key).get<std::string>();
    if (text.size() > maximum || text.find('\0') != std::string::npos)
        throw Error(400, std::string("Invalid length or NUL: ") + key);
    if (required && text.find_first_not_of(" \t\r\n") == std::string::npos)
        throw Error(400, std::string("Empty field: ") + key);
    return text;
}
int integer_field(const Json &value, const char *key, int low, int high) {
    if (!value.contains(key) || !value.at(key).is_number_integer())
        throw Error(400, std::string("Expected integer: ") + key);
    auto n = value.at(key).get<int64_t>();
    if (n < low || n > high)
        throw Error(400, std::string("Out of range: ") + key);
    return static_cast<int>(n);
}
std::string token(const httplib::Request &req) {
    const std::string cookie = req.get_header_value("Cookie");
    std::smatch match;
    if (!std::regex_search(cookie, match,
                           std::regex("(?:^|;[ ]*)devdesk_session=([a-f0-9]{64})(?:;|$)")))
        throw Error(401, "Please sign in");
    return match[1];
}
struct Identity {
    std::string id, name, username, csrf;
};
Identity authenticate(Database &db, const httplib::Request &req, bool write) {
    const auto raw = token(req);
    auto result = db.query(
        "SELECT e.id,e.name,e.username FROM sessions s JOIN employees e ON e.id=s.employee_id "
        "WHERE s.token_hash=$1 AND NOT s.revoked AND s.expires_at>now() AND e.active",
        {hash(raw)});
    if (result.rows() != 1)
        throw Error(401, "Session expired; please sign in");
    Identity user{result.get(0, "id"), result.get(0, "name"), result.get(0, "username"),
                  hash("csrf:" + raw)};
    if (write && !equal_secret(req.get_header_value("X-CSRF-Token"), user.csrf))
        throw Error(403, "Invalid CSRF token");
    return user;
}
void membership(Database &db, const Identity &user, const std::string &project = "1") {
    if (db.query("SELECT 1 FROM memberships WHERE employee_id=$1 AND project_id=$2",
                 {user.id, project})
            .rows() != 1)
        throw Error(403, "Project access denied");
}
const std::string ticket_select =
    "SELECT "
    "t.id,t.state,t.cancel_requested,t.priority,t.rule_id,t.priority_reason,t.created_at,r.title,r.description,r."
    "reproduction,r.kind,r.page_url,r.viewport_width,r.viewport_height,r.reported_impact,r.upload_"
    "id,r.employee_id,r.project_id,e.name AS reporter,i.state AS investigation_state,i.confirmed "
    "FROM tickets t JOIN requests r ON r.id=t.request_id JOIN employees e ON e.id=r.employee_id "
    "JOIN investigations i ON i.id=t.investigation_id ";
Json ticket(Database &db, const std::string &id) {
    auto row = db.query(ticket_select + "WHERE t.id=$1", {id});
    if (!row.rows())
        throw Error(404, "Ticket not found");
    return row.json()[0];
}
} // namespace
void install_routes(httplib::Server &server, Database &db, const Json &config, int port) {
    const auto upload_path = std::filesystem::path(config.at("uploads").get<std::string>());
    std::filesystem::create_directories(upload_path);
    const auto host = "127.0.0.1:" + std::to_string(port), origin = "http://" + host;
    server.set_pre_routing_handler([host, origin](const auto &req, auto &res) {
        if (req.get_header_value("Host") != host) {
            reply(res, {{"error", "Invalid host"}}, 403);
            return httplib::Server::HandlerResponse::Handled;
        }
        if (req.method != "GET" && req.method != "HEAD" && req.get_header_value("Origin") != "" &&
            req.get_header_value("Origin") != origin) {
            reply(res, {{"error", "Origin denied"}}, 403);
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });
    server.set_post_routing_handler([](const auto &, auto &res) {
        res.set_header("X-Content-Type-Options", "nosniff");
        res.set_header("Cache-Control", "no-store");
        res.set_header("Content-Security-Policy",
                       "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' "
                       "blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; "
                       "base-uri 'none'; form-action 'self'");
        res.set_header("Referrer-Policy", "no-referrer");
    });
    using Handler = std::function<void(const httplib::Request &, httplib::Response &)>;
    auto guarded = [&db](Handler handler) {
        return [&db, handler](const auto &req, auto &res) {
            std::lock_guard lock(db.mutex);
            try {
                handler(req, res);
            } catch (const Error &e) {
                reply(res, {{"error", e.what()}}, e.status);
            } catch (const std::exception &) {
                reply(res,
                      {{"error", "Operation failed; no success is claimed. Retry with the same "
                                 "request key if submission status is uncertain."}},
                      500);
            }
        };
    };
    struct Attempts {
        int count = 0;
        std::chrono::steady_clock::time_point until;
    };
    auto attempts = std::make_shared<std::map<std::string, Attempts>>();
    server.Post(
        "/api/login", guarded([&db, attempts](const auto &req, auto &res) {
            auto value = body(req, {"username", "password"});
            auto username = text_field(value, "username", 64),
                 password = text_field(value, "password", 128);
            if (!std::regex_match(username, std::regex("[a-z]{1,32}")))
                throw Error(401, "Incorrect username or password");
            const auto now = std::chrono::steady_clock::now();
            for (auto it = attempts->begin(); it != attempts->end();)
                if (it->second.until < now)
                    it = attempts->erase(it);
                else
                    ++it;
            if (attempts->size() > 1000)
                throw Error(429, "Too many sign-in attempts; try later");
            auto &attempt = (*attempts)[username];
            if (attempt.count >= 5 && attempt.until > now)
                throw Error(429, "Too many sign-in attempts; wait five minutes");
            auto row =
                db.query("SELECT id,salt,password_hash FROM employees WHERE username=$1 AND active",
                         {username});
            auto computed =
                password_hash(password, row.rows() ? row.get(0, "salt") : std::string(32, '0'));
            if (!row.rows() || !equal_secret(computed, row.get(0, "password_hash"))) {
                ++attempt.count;
                attempt.until = now + std::chrono::minutes(5);
                throw Error(401, "Incorrect username or password");
            }
            attempts->erase(username);
            const auto session = random_hex(32);
            db.query("INSERT INTO sessions(token_hash,employee_id,expires_at) "
                     "VALUES($1,$2,now()+interval '8 hours')",
                     {hash(session), row.get(0, "id")});
            res.set_header("Set-Cookie", "devdesk_session=" + session +
                                             "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800");
            reply(res, {{"signed_in", true}});
        }));
    server.Get("/api/me", guarded([&db](const auto &req, auto &res) {
                   auto user = authenticate(db, req, false);
                   auto projects =
                       db.query("SELECT p.id,p.name FROM projects p JOIN memberships m ON "
                                "m.project_id=p.id WHERE m.employee_id=$1 ORDER BY p.id",
                                {user.id});
                   reply(res, {{"id", user.id},
                               {"name", user.name},
                               {"username", user.username},
                               {"csrf", user.csrf},
                               {"projects", projects.json()}});
               }));
    server.Post(
        "/api/logout", guarded([&db](const auto &req, auto &res) {
            authenticate(db, req, true);
            db.query("UPDATE sessions SET revoked=true WHERE token_hash=$1", {hash(token(req))});
            res.set_header("Set-Cookie",
                           "devdesk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
            reply(res, {{"signed_in", false}});
        }));
    server.Post(
        "/api/uploads", guarded([&db, upload_path](const auto &req, auto &res) {
            auto user = authenticate(db, req, true);
            membership(db, user);
            if (!req.is_multipart_form_data() || req.form.files.size() != 1 ||
                !req.form.has_file("screenshot") || !req.form.fields.empty())
                throw Error(400, "Upload one screenshot file");
            const auto file = req.form.get_file("screenshot");
            const auto image = decode_image(file.content);
            if (file.content_type != image.mime)
                throw Error(400, "Declared image type does not match decoded content");
            const auto id = random_hex(16),
                       filename = id + (image.mime == "image/png" ? ".png" : ".jpg");
            const auto path = upload_path / filename;
            std::ofstream output(path, std::ios::binary);
            output.write(file.content.data(), static_cast<std::streamsize>(file.content.size()));
            output.close();
            if (!output) {
                std::filesystem::remove(path);
                throw std::runtime_error("Evidence write failed");
            }
            try {
                db.query(
                    "INSERT INTO uploads(id,employee_id,filename,mime,bytes,width,height,sha256) "
                    "VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
                    {id, user.id, filename, image.mime, std::to_string(file.content.size()),
                     std::to_string(image.width), std::to_string(image.height),
                     hash(file.content)});
            } catch (...) {
                std::filesystem::remove(path);
                throw;
            }
            reply(res,
                  {{"id", id},
                   {"width", image.width},
                   {"height", image.height},
                   {"mime", image.mime}},
                  201);
        }));
    server.Get(
        R"(/api/uploads/([a-f0-9]{32}))", guarded([&db, upload_path](const auto &req, auto &res) {
            auto user = authenticate(db, req, false);
            const auto id = req.matches[1].str();
            auto row = db.query(
                "SELECT u.filename,u.mime FROM uploads u WHERE u.id=$1 AND "
                "(u.employee_id=$2 OR EXISTS(SELECT 1 FROM requests r JOIN memberships m ON "
                "m.project_id=r.project_id WHERE r.upload_id=u.id AND m.employee_id=$2) OR "
                "EXISTS(SELECT 1 FROM observations o JOIN investigation_runs ir ON ir.id=o.run_id "
                "JOIN tickets t ON t.id=ir.ticket_id JOIN requests r ON r.id=t.request_id "
                "JOIN memberships m ON m.project_id=r.project_id WHERE o.upload_id=u.id AND "
                "m.employee_id=$2))",
                {id, user.id});
            if (!row.rows())
                throw Error(404, "Evidence not found or access denied");
            auto filename = row.get(0, "filename");
            if (!std::regex_match(filename, std::regex("[a-f0-9]{32}\\.(png|jpg)")))
                throw std::runtime_error("Invalid stored filename");
            std::ifstream input(upload_path / filename, std::ios::binary);
            if (!input)
                throw Error(404, "Evidence file unavailable");
            std::string bytes((std::istreambuf_iterator<char>(input)), {});
            res.set_content(bytes, row.get(0, "mime"));
        }));
    server.Post(
        "/api/requests", guarded([&db](const auto &req, auto &res) {
            auto user = authenticate(db, req, true);
            auto value =
                body(req, {"project_id", "kind", "title", "description", "reproduction", "page_url",
                           "viewport_width", "viewport_height", "reported_impact", "upload_id"});
            const auto project = std::to_string(integer_field(value, "project_id", 1, 1));
            membership(db, user, project);
            const auto kind = text_field(value, "kind", 10),
                       title = text_field(value, "title", 120),
                       description = text_field(value, "description", 4000),
                       reproduction = text_field(value, "reproduction", 2000, false),
                       url = text_field(value, "page_url", 2048),
                       impact = text_field(value, "reported_impact", 32),
                       upload = text_field(value, "upload_id", 32, false);
            if (kind != "bug" && kind != "feature")
                throw Error(400, "Kind must be bug or feature");
            if (kind == "bug" && reproduction.find_first_not_of(" \r\n\t") == std::string::npos)
                throw Error(400, "Bug reports need reproduction steps");
            if (!std::set<std::string>{"cosmetic", "local_functional", "core_workflow", "data_loss"}
                     .contains(impact))
                throw Error(400, "Unknown reported impact");
            if (!std::regex_match(
                    url, std::regex(R"(http://127\.0\.0\.1:808[0-3](/[A-Za-z0-9_./?=&%+-]*)?)")))
                throw Error(400, "URL must use a controlled playground origin (ports 8080–8083)");
            const auto width = integer_field(value, "viewport_width", 200, 4096),
                       height = integer_field(value, "viewport_height", 200, 4096);
            if (!upload.empty() && !std::regex_match(upload, std::regex("[a-f0-9]{32}")))
                throw Error(400, "Invalid screenshot ID");
            const auto key = req.get_header_value("Idempotency-Key");
            if (!std::regex_match(key, std::regex("[A-Za-z0-9_-]{16,128}")))
                throw Error(400, "A 16–128 character Idempotency-Key is required");
            // Canonical defaults make equivalent retries stable; never trust reporter identity from
            // JSON.
            Json canonical = {{"project", project},
                              {"kind", kind},
                              {"title", title},
                              {"description", description},
                              {"reproduction", reproduction},
                              {"url", url},
                              {"width", width},
                              {"height", height},
                              {"impact", impact},
                              {"upload", upload}};
            const auto digest = hash(canonical.dump());
            Transaction transaction(db);
            // Row lock also serializes independent API processes submitting for the same employee.
            db.query("SELECT id FROM employees WHERE id=$1 FOR UPDATE", {user.id});
            auto existing =
                db.query("SELECT r.payload_hash,t.id FROM requests r JOIN tickets t ON "
                         "t.request_id=r.id WHERE r.employee_id=$1 AND r.operation_key=$2",
                         {user.id, key});
            if (existing.rows()) {
                if (existing.get(0, "payload_hash") != digest)
                    throw Error(409, "Request key already used with different report data");
                auto output = ticket(db, existing.get(0, "id"));
                transaction.commit();
                reply(res, {{"ticket", output}, {"replayed", true}});
                return;
            }
            if (!upload.empty() &&
                db.query("SELECT id FROM uploads WHERE id=$1 AND employee_id=$2 AND NOT "
                         "EXISTS(SELECT 1 FROM requests WHERE upload_id=$1)",
                         {upload, user.id})
                        .rows() != 1)
                throw Error(403, "Screenshot is not an available upload owned by you");
            auto request = db.query(
                "INSERT INTO "
                "requests(employee_id,project_id,operation_key,payload_hash,kind,title,description,"
                "reproduction,page_url,viewport_width,viewport_height,reported_impact,upload_id) "
                "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULLIF($13,'')) RETURNING id",
                {user.id, project, key, digest, kind, title, description, reproduction, url,
                 std::to_string(width), std::to_string(height), impact, upload});
            auto investigation =
                db.query("INSERT INTO investigations(request_id) VALUES($1) RETURNING id",
                         {request.get(0, "id")});
            const bool lower = kind == "feature" || impact == "cosmetic";
            const auto priority = lower ? "3" : "2",
                       rule = lower ? "provisional-v1-low" : "provisional-v1-unconfirmed";
            const std::string reason = lower ? "P3 provisional: cosmetic report or proposed "
                                               "enhancement; not confirmed or authorized."
                                             : "P2 provisional: reported functional impact awaits "
                                               "independent evidence; P0/P1 require confirmation.";
            auto created = db.query(
                "INSERT INTO tickets(request_id,investigation_id,priority,rule_id,priority_reason) "
                "VALUES($1,$2,$3,$4,$5) RETURNING id",
                {request.get(0, "id"), investigation.get(0, "id"), priority, rule, reason});
            const auto id = created.get(0, "id");
            db.query("INSERT INTO events(ticket_id,actor_id,type,message) "
                     "VALUES($1,$2,'submitted','Report persisted; investigation queued. No source "
                     "change is authorized.')",
                     {id, user.id});
            db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) "
                     "VALUES($1,$2,$3,'Report received. Awaiting independent investigation.')",
                     {user.id, id, "submitted:" + id});
            auto output = ticket(db, id);
            transaction.commit();
            reply(res, {{"ticket", output}, {"replayed", false}}, 201);
        }));
    server.Get(
        "/api/tickets", guarded([&db](const auto &req, auto &res) {
            auto user = authenticate(db, req, false);
            membership(db, user);
            const auto view = req.has_param("view") ? req.get_param_value("view") : "queue";
            if (view != "queue" && view != "history")
                throw Error(400, "View must be queue or history");
            auto rows = db.query(
                ticket_select +
                    "WHERE r.project_id=1 AND (($1='queue' AND t.state NOT IN('CANCELLED','COMPLETED','CANDIDATE_REJECTED','INVALID')) OR "
                    "($1='history' AND t.state IN('CANCELLED','COMPLETED','CANDIDATE_REJECTED','INVALID'))) ORDER BY t.priority,t.created_at,t.id",
                {view});
            reply(res, {{"tickets", rows.json()}});
        }));
    server.Get(
        R"(/api/tickets/([0-9]+))", guarded([&db](const auto &req, auto &res) {
            auto user = authenticate(db, req, false);
            auto output = ticket(db, req.matches[1].str());
            membership(db, user, output.at("project_id"));
            auto events = db.query("SELECT id,type,message,actor_kind,created_at FROM events WHERE "
                                   "ticket_id=$1 ORDER BY id",
                                   {req.matches[1].str()});
            auto runs = db.query(
                "SELECT "
                "id,mode,state,model,prompt_version,worker_build,base_commit,app_build,summary,"
                "verdict,model_calls,input_tokens,output_tokens,estimated_usd,usage_complete,"
                "started_at,finished_"
                "at FROM investigation_runs WHERE ticket_id=$1 ORDER BY started_at,id",
                {req.matches[1].str()});
            auto observations =
                db.query("SELECT "
                         "o.id,o.run_id,o.step,o.tool,o.tool_version,o.result,o.upload_id,o."
                         "created_at FROM observations o JOIN investigation_runs ir ON "
                         "ir.id=o.run_id WHERE ir.ticket_id=$1 ORDER BY ir.started_at,o.step",
                         {req.matches[1].str()});
            auto decisions =
                db.query("SELECT "
                         "d.run_id,d.step,d.state,d.action,d.provider_request_id,d.input_tokens,d."
                         "output_tokens,d.duration_ms FROM decisions d JOIN investigation_runs ir "
                         "ON ir.id=d.run_id WHERE ir.ticket_id=$1 ORDER BY ir.started_at,d.step",
                         {req.matches[1].str()});
            auto proposals =
                db.query("SELECT "
                         "id,revision,profile,base_commit,app_build,files,criteria,risk,scope_hash,state,"
                         "expires_at FROM scope_proposals WHERE ticket_id=$1 ORDER BY created_at",
                         {req.matches[1].str()});
            auto repairs = db.query(
                "SELECT "
                "id,proposal_id,profile,mode,state,base_commit,candidate_commit,diff,summary,model,model_"
                "calls,input_tokens,output_tokens,estimated_usd,usage_complete,started_at,finished_"
                "at FROM repair_runs WHERE ticket_id=$1 ORDER BY started_at",
                {req.matches[1].str()});
            auto repair_steps = db.query(
                "SELECT s.run_id,s.step,s.state,s.action,s.result FROM repair_steps s JOIN "
                "repair_runs r ON r.id=s.run_id WHERE r.ticket_id=$1 ORDER BY r.started_at,s.step",
                {req.matches[1].str()});
            reply(res, {{"ticket", output},
                        {"events", events.json()},
                        {"runs", runs.json()},
                        {"observations", observations.json()},
                        {"decisions", decisions.json()},
                        {"proposals", proposals.json()},
                        {"polls",feature_poll_detail(db,req.matches[1].str())},
                        {"repairs", repairs.json()},
                        {"repair_steps", repair_steps.json()},
                        {"reviews",db.query("SELECT cr.* FROM candidate_reviews cr JOIN repair_runs rr ON rr.id=cr.repair_id WHERE rr.ticket_id=$1 ORDER BY cr.created_at",{req.matches[1].str()}).json()},
                        {"integrations",db.query("SELECT * FROM integration_runs WHERE ticket_id=$1 ORDER BY started_at",{req.matches[1].str()}).json()}});
        }));
    server.Post(R"(/api/feature-polls/([a-f0-9]{32})/vote)",guarded([&db](const auto &req,auto &res){auto user=authenticate(db,req,true);membership(db,user);auto input=body(req,{"goal_hash","choice"});input["goal_hash"]=text_field(input,"goal_hash",64);input["choice"]=text_field(input,"choice",3);reply(res,cast_feature_vote(db,user.id,req.matches[1].str(),input));}));
    server.Post(R"(/api/repairs/([a-f0-9]{32})/review)",guarded([&db](const auto &req,auto &res){
        auto user=authenticate(db,req,true);membership(db,user);body(req,{});
        reply(res,prepare_review(db,user.id,req.matches[1].str()));
    }));
    server.Post(R"(/api/candidate-reviews/([a-f0-9]{32})/decision)",guarded([&db](const auto &req,auto &res){
        auto user=authenticate(db,req,true);membership(db,user);auto input=body(req,{"review_hash","decision"});
        input["review_hash"]=text_field(input,"review_hash",64);input["decision"]=text_field(input,"decision",8);
        reply(res,decide_review(db,user.id,req.matches[1].str(),input));
    }));
    server.Get(R"(/api/repairs/([a-f0-9]{32})/artifacts/(390|1280)\.png)",
               guarded([&db](const auto &req, auto &res) {
                   auto user = authenticate(db, req, false);
                   membership(db, user);
                   auto row = db.query(
                       "SELECT rr.id FROM repair_runs rr JOIN tickets t ON t.id=rr.ticket_id JOIN "
                       "requests r ON r.id=t.request_id WHERE rr.id=$1 AND r.project_id=1",
                       {req.matches[1].str()});
                   if (!row.rows())
                       throw Error(404, "Repair not found");
                   auto step = db.query(
                       "SELECT step FROM repair_steps WHERE run_id=$1 AND state='OBSERVED' AND "
                       "action->>'tool'='run_checks' ORDER BY step DESC LIMIT 1",
                       {req.matches[1].str()});
                   if (!step.rows())
                       throw Error(404, "Candidate evidence unavailable");
                   wchar_t executable[MAX_PATH];
                   if (!GetModuleFileNameW(nullptr, executable, MAX_PATH))
                       throw Error(503, "Evidence root unavailable");
                   auto root = std::filesystem::path(executable).parent_path();
                   for (int i = 0; i < 4; ++i)
                       root = root.parent_path();
                   const auto directory =
                       root / "var/repair-evidence" / req.matches[1].str() / step.get(0, "step");
                   const auto file = directory / (req.matches[2].str() + ".png");
                   if (!std::filesystem::exists(file) ||
                       std::filesystem::file_size(file) > 5 * 1024 * 1024)
                       throw Error(404, "Evidence image unavailable");
                   std::ifstream input(file, std::ios::binary);
                   std::string bytes((std::istreambuf_iterator<char>(input)), {});
                   decode_image(bytes);
                   res.set_content(bytes, "image/png");
               }));
    server.Post(
        R"(/api/tickets/([0-9]+)/proposal)", guarded([&db](const auto &req, auto &res) {
            auto user = authenticate(db, req, true);
            body(req, {});
            membership(db, user);
            Transaction transaction(db);
            const auto id = req.matches[1].str();
            auto row =
                db.query("SELECT t.state,r.employee_id,r.kind,r.page_url,r.title,r.description,i.confirmed FROM tickets "
                         "t JOIN requests r ON r.id=t.request_id JOIN investigations i ON "
                         "i.id=t.investigation_id WHERE t.id=$1 FOR UPDATE OF t",
                         {id});
            if (!row.rows())
                throw Error(404, "Ticket not found");
            if (row.get(0, "employee_id") != user.id)
                throw Error(403, "Only the reporter may prepare this scope");
            auto prior = db.query("SELECT id FROM scope_proposals WHERE ticket_id=$1 AND state IN('PROPOSED','APPROVED') AND expires_at>now() ORDER BY revision DESC LIMIT 1", {id});
            if (prior.rows()) {
                transaction.commit();
                reply(res, {{"proposal_id", prior.get(0, "id")}});
                return;
            }
            const auto expired=db.query("UPDATE scope_proposals SET state='STALE' WHERE ticket_id=$1 AND state IN('PROPOSED','APPROVED') AND expires_at<=now() RETURNING id",{id});
            if ((row.get(0, "state") != "INVESTIGATED_READ_ONLY"&&!(expired.rows()&&(row.get(0,"state")=="READY"||row.get(0,"state")=="AWAITING_BUG_APPROVAL"))) || (row.get(0, "kind")=="bug"&&row.get(0, "confirmed") != "t"))
                throw Error(409, "An eligible completed investigation is required");
            const auto url=row.get(0,"page_url");std::smatch origin;
            if(!std::regex_search(url,origin,std::regex(R"(^http://127\.0\.0\.1:808([123])(?:/|$))")))throw Error(409,"This origin has no approved repair profile");
            const bool feature=row.get(0,"kind")=="feature";
            if(feature&&(origin[1]!="3"||!std::regex_search(row.get(0,"title")+" "+row.get(0,"description"),std::regex("completed",std::regex::icase))||!std::regex_search(row.get(0,"title")+" "+row.get(0,"description"),std::regex("filter",std::regex::icase))))throw Error(409,"Current feature capability is the Completed filter on port8083; other proposals need a new reviewed capability");
            if(!feature&&origin[1]=="3")throw Error(409,"Feature origin requires a feature request");
            const std::string profile=feature?"feature":origin[1]=="2"?"backend":"frontend";
            auto run = db.query(
                "SELECT id,base_commit,app_build FROM investigation_runs WHERE ticket_id=$1 AND "
                "state='FINISHED' AND verdict='reproduced' ORDER BY finished_at DESC LIMIT 1",
                {id});
            if (!run.rows())
                throw Error(409, "A reproduced investigation is required");
            const auto head=repair_helper(runtime_release(),runtime_root()/"var/read-jobs"/random_hex(16),{{"root",runtime_root().string()},{"run_id",random_hex(16)},{"op","head"},{"profile",profile}});
            if(!head.at("clean").get<bool>()||head.at("commit")!=run.get(0,"base_commit"))throw Error(409,"Investigation base changed; authorize a fresh investigation first");
            auto observed = db.query(
                "SELECT result FROM observations WHERE run_id=$1 AND tool IN('browser_observe','api_observe')",
                {run.get(0, "id")});
            bool failed_geometry = false;
            for (const auto &o : observed.json())
                for (const auto &a : Json::parse(o.at("result").template get<std::string>())
                                         .value("assertions", Json::array()))
                    failed_geometry |=
                        a.value("name", std::string()) == (profile=="backend"?"status_filter_exact":profile=="feature"?"completed_filter_present":"action_buttons_separate") &&
                        a.value("result", std::string()) == "FAIL";
            if (!failed_geometry)
                throw Error(409, "Appropriate live failing evidence is required for this scope");
            Json files = Json::array({repair_profile(profile).file});
            Json criteria =
                Json::array({"Button geometry: separate and enabled at 390x844 and 1280x800",
                             "No horizontal overflow or browser errors",
                             "Task listing/status filters and create/advance remain functional"});
            if(profile=="backend")criteria=Json::array({"Status filters return exactly matching SQLite rows before and after mutations","Seeded task IDs/statuses match independent database reads","Create, advance, remove and both UI viewports remain functional","Only list_tasks may change; no schema/data migration or evaluator changes"});
            if(feature)criteria=Json::array({"Add a visible, enabled Completed filter returning exactly done tasks at both390 and1280 widths","Existing All tasks, To do and In progress filters, create/advance/remove remain functional","Only static/index.html may change; no scripts, API, storage or evaluator edits"});
            const std::string risk=feature?"Feature: Completed filter in static/index.html only. Snapshot two-thirds vote and reporter scope approval required; three patches/twelve actions. Exact candidate acceptance remains required.":profile=="backend"?"Backend list_tasks function only; no schema, data migration, route, seed or other-function edits. Three patches and twelve actions; exact-candidate acceptance remains required.":"CSS layout only; no backend/API changes. Three patches and twelve actions; exact-candidate acceptance remains required.";
            const auto proposal = random_hex(16),
                       scope_hash =
                           hash(profile+":"+run.get(0, "base_commit") + ":" + run.get(0, "app_build") + ":" +
                                files.dump() + ":" + criteria.dump() + ":3-patches:12-actions:"+proposal);
            db.query("INSERT INTO "
                     "scope_proposals(id,ticket_id,investigation_run,base_commit,app_build,files,"
                     "criteria,risk,scope_hash,expires_at,profile) "
                     "VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$9,$8,now()+interval '30 minutes',$10)",
                     {proposal, id, run.get(0, "id"), run.get(0, "base_commit"),
                      run.get(0, "app_build"), files.dump(), criteria.dump(), scope_hash,risk,profile});
            db.query("UPDATE scope_proposals SET revision=(SELECT coalesce(max(revision),0)+1 FROM scope_proposals WHERE ticket_id=$2 AND id<>$1) WHERE id=$1",{proposal,id});
            if(feature)open_feature_poll(db,proposal);
            db.query("UPDATE tickets SET state=$2 WHERE id=$1", {id,feature?"AWAITING_FEATURE_VOTE":"AWAITING_BUG_APPROVAL"});
            db.query("INSERT INTO events(ticket_id,actor_id,type,message) "
                     "VALUES($1,$2,'scope_proposed','Versioned source scope prepared; "
                     "reporter approval required.')",
                     {id, user.id});
            db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) "
                     "VALUES($1,$2,$3,'Review the source repair scope; source changes are not "
                     "yet authorized.')",
                     {user.id, id, "proposal:" + proposal});
            transaction.commit();
            reply(res, {{"proposal_id", proposal}}, 201);
        }));
    server.Post(
        R"(/api/proposals/([a-f0-9]{32})/approve)", guarded([&db](const auto &req, auto &res) {
            auto user = authenticate(db, req, true);
            membership(db, user);
            auto data = body(req, {"scope_hash"});
            const auto digest = text_field(data, "scope_hash", 64);
            Transaction transaction(db);
            const auto id = req.matches[1].str();
            auto row = db.query("SELECT p.ticket_id,p.base_commit,p.profile,p.files,p.scope_hash,p.state,p.expires_at>now() AS "
                                "fresh,r.employee_id,t.state AS ticket_state FROM scope_proposals "
                                "p JOIN tickets t ON t.id=p.ticket_id JOIN requests r ON "
                                "r.id=t.request_id WHERE p.id=$1 FOR UPDATE OF p,t",
                                {id});
            if (!row.rows())
                throw Error(404, "Proposal not found");
            if (row.get(0, "employee_id") != user.id)
                throw Error(403, "Only this report's requester may approve source changes");
            if (row.get(0, "scope_hash") != digest || row.get(0, "fresh") != "t")
                throw Error(409, "Scope changed or approval window expired");
            if(Json::parse(row.get(0,"files"))!=Json::array({repair_profile(row.get(0,"profile")).file}))throw Error(409,"Scope files differ from the registered profile; renew scope");
            if (row.get(0, "state") == "APPROVED") {
                transaction.commit();
                reply(res, {{"state", row.get(0, "ticket_state")}});
                return;
            }
            if (row.get(0, "state") != "PROPOSED" ||
                (row.get(0, "ticket_state") != "AWAITING_BUG_APPROVAL"&&row.get(0, "ticket_state") != "AWAITING_FEATURE_VOTE"))
                throw Error(409, "Proposal is not eligible for approval");
            const Json source=repair_helper(runtime_release(),runtime_root()/"var/read-jobs"/random_hex(16),{{"root",runtime_root().string()},{"run_id",random_hex(16)},{"op","head"},{"profile",row.get(0,"profile")}});
            if(!source.at("clean").get<bool>()||source.at("commit")!=row.get(0,"base_commit"))throw Error(409,"Source base changed; this scope cannot authorize edits");
            db.query(
                "INSERT INTO scope_approvals(proposal_id,employee_id,scope_hash) VALUES($1,$2,$3)",
                {id, user.id, digest});
            db.query("UPDATE scope_proposals SET state='APPROVED' WHERE id=$1", {id});
            const bool feature=row.get(0,"profile")=="feature";
            db.query("UPDATE tickets SET state=$2 WHERE id=$1", {row.get(0, "ticket_id"),feature?"AWAITING_FEATURE_VOTE":"READY"});
            if(feature)reconcile_feature_polls(db);
            db.query("INSERT INTO events(ticket_id,actor_id,type,message) "
                     "VALUES($1,$2,'scope_approved','Requester approved this exact "
                     "scope/base/criteria within its expiry; feature consensus remains required when applicable.')",
                     {row.get(0, "ticket_id"), user.id});
            transaction.commit();
            reply(res, {{"state",ticket(db,row.get(0,"ticket_id")).at("state")}});
        }));
    server.Post(
        R"(/api/tickets/([0-9]+)/cancel)", guarded([&db,&config](const auto &req, auto &res) {
            auto user = authenticate(db, req, true);
            body(req, {});
            Transaction transaction(db);
            const auto id = req.matches[1].str();
            auto row =
                db.query("SELECT t.state,t.cancel_requested,r.employee_id,t.investigation_id FROM tickets t JOIN "
                         "requests r ON r.id=t.request_id WHERE t.id=$1 FOR UPDATE OF t",
                         {id});
            if (!row.rows())
                throw Error(404, "Ticket not found");
            if (row.get(0, "employee_id") != user.id)
                throw Error(403, "Only the requester can withdraw this report");
            membership(db, user);
            const auto state=row.get(0,"state");
            if(state=="INVALID")throw Error(409,"Invalid consensus reports retain their final history state");
            if(state=="COMPLETED"||state=="INTEGRATING")throw Error(409,"Integration has crossed the source mutation boundary; cancellation cannot undo it.");
            const bool active=state=="INVESTIGATING"||state=="IMPLEMENTING"||state=="VERIFYING";
            if(state!="CANCELLED"&&row.get(0,"cancel_requested")!="t"){
                mark_cancellation(config,id);
                db.query("UPDATE tickets SET cancel_requested=true,state=$2 WHERE id=$1",{id,active?state:"CANCELLED"});
                if(!active)db.query("UPDATE investigations SET state='cancelled' WHERE id=$1",{row.get(0,"investigation_id")});
                db.query("UPDATE scope_proposals SET state='STALE' WHERE ticket_id=$1 AND state IN('PROPOSED','APPROVED')",{id});
                db.query("UPDATE candidate_reviews cr SET state='STALE' FROM repair_runs rr WHERE cr.repair_id=rr.id AND rr.ticket_id=$1 AND cr.state IN('PENDING','ACCEPTED')",{id});
                db.query("INSERT INTO events(ticket_id,actor_id,type,message) "
                         "VALUES($1,$2,'cancelled','Requester requested cancellation; evidence "
                         "retained.')",
                         {id, user.id});
                db.query("INSERT INTO notifications(employee_id,ticket_id,operation_key,message) "
                         "VALUES($1,$2,$3,'Cancellation requested; existing evidence retained. Active calls stop at the next safe boundary.') ON CONFLICT(operation_key) DO NOTHING",
                         {user.id, id, "cancelled:" + id});
            }
            transaction.commit();
            reply(res, {{"state", active?"CANCEL_REQUESTED":"CANCELLED"}});
        }));
    server.Post(R"(/api/tickets/([0-9]+)/retry-investigation)",guarded([&db](const auto &req,auto &res){
        auto user=authenticate(db,req,true);membership(db,user);body(req,{});Transaction tx(db);const auto id=req.matches[1].str();
        auto row=db.query("SELECT t.state,t.cancel_requested,r.employee_id FROM tickets t JOIN requests r ON r.id=t.request_id WHERE t.id=$1 FOR UPDATE OF t",{id});
        if(!row.rows())throw Error(404,"Report not found");
        if(row.get(0,"employee_id")!=user.id)throw Error(403,"Only the requester may authorize a new investigation");
        if(row.get(0,"state")=="QUEUED"){tx.commit();reply(res,{{"state","QUEUED"}});return;}
        if(row.get(0,"cancel_requested")=="t"||(row.get(0,"state")!="NEEDS_INFORMATION"&&row.get(0,"state")!="INVESTIGATED_READ_ONLY"&&row.get(0,"state")!="REPAIR_BLOCKED"))throw Error(409,"This report cannot be reinvestigated in its current state");
        db.query("UPDATE tickets SET state='QUEUED' WHERE id=$1",{id});db.query("UPDATE investigations SET state='queued',confirmed=false WHERE id=(SELECT investigation_id FROM tickets WHERE id=$1)",{id});
        db.query("UPDATE scope_proposals SET state='STALE' WHERE ticket_id=$1 AND state IN('PROPOSED','APPROVED')",{id});
        db.query("INSERT INTO events(ticket_id,actor_id,type,message) VALUES($1,$2,'retry_authorized','Requester authorized a fresh investigation; previous uncertain calls are not replayed.')",{id,user.id});tx.commit();reply(res,{{"state","QUEUED"}});
    }));
    server.Get("/api/notifications", guarded([&db](const auto &req, auto &res) {
                   auto user = authenticate(db, req, false);
                   auto rows = db.query("SELECT id,ticket_id,message,read_at,created_at FROM "
                                        "notifications WHERE employee_id=$1 ORDER BY id DESC",
                                        {user.id});
                   reply(res, {{"notifications", rows.json()}});
               }));
    server.Post(R"(/api/notifications/([0-9]+)/read)", guarded([&db](const auto &req, auto &res) {
                    auto user = authenticate(db, req, true);
                    body(req, {});
                    auto row = db.query("UPDATE notifications SET read_at=COALESCE(read_at,now()) "
                                        "WHERE id=$1 AND employee_id=$2 RETURNING id",
                                        {req.matches[1].str(), user.id});
                    if (!row.rows())
                        throw Error(404, "Notification not found");
                    reply(res, {{"read", true}});
                }));
}
} // namespace devdesk
