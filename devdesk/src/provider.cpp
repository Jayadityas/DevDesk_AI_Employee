#include "worker.hpp"
#include "repair.hpp"
#include <windows.h>
#include <winhttp.h>
#include <iostream>
namespace devdesk {
namespace {
Json provider_http(const Json &config, const wchar_t *method, const wchar_t *path,
                   const std::string &payload);
struct Internet {
    HINTERNET handle = nullptr;
    ~Internet() {
        if (handle)
            WinHttpCloseHandle(handle);
    }
};
void network_check(bool ok) {
    if (!ok)
        throw Error(503, "Model HTTPS transport failed (Windows error " +
                             std::to_string(GetLastError()) +
                             "); credentials and provider body withheld");
}
} // namespace
Json action_schema() {
    Json properties = {
        {"tool",
         {{"type", "string"},
          {"enum",
           {"project_instructions", "source_list", "source_read", "source_search", "api_observe",
            "browser_observe", "finish"}}}},
        {"path", {{"type", "string"}}},
        {"query", {{"type", "string"}}},
        {"status", {{"type", "string"}, {"enum", {"", "todo", "in_progress", "done"}}}},
        {"start_line",
         {{"type", "integer"},
          {"minimum", 1},
          {"maximum", 10000},
          {"description", "Use 1 unless source_read needs another line; never 0."}}},
        {"limit",
         {{"type", "integer"},
          {"minimum", 1},
          {"maximum", 160},
          {"description", "Use 80 for unused line limits; never 0."}}},
        {"verdict",
         {{"type", "string"}, {"enum", {"", "reproduced", "not_reproduced", "needs_information"}}}},
        {"summary", {{"type", "string"}}},
        {"evidence_ids",
         {{"type", "array"},
          {"items", {{"type", "string"}}},
          {"description",
           "MUST be [] for every tool except finish. Only finish may cite observation IDs."}}}};
    Json required = Json::array();
    for (auto it = properties.begin(); it != properties.end(); ++it)
        required.push_back(it.key());
    return {{"type", "object"},
            {"properties", properties},
            {"required", required},
            {"additionalProperties", false}};
}
Json decision_schema(const Json &context) {
    auto schema = action_schema();
    bool project = false, source = false, live = false, listed = false;
    for (const auto &observation : context.value("observations", Json::array())) {
        const auto &result = observation.at("result");
        if (result.contains("error"))
            continue;
        const auto tool = observation.at("tool").get<std::string>();
        project |= tool == "project_instructions";
        listed |= tool == "source_list";
        source |= tool == "source_read";
        live |= (context.value("investigation_profile",std::string())=="backend"?tool=="api_observe":context.value("investigation_profile",std::string())=="feature"?tool=="browser_observe":(tool == "browser_observe" || tool == "api_observe")) &&
                !result.value("assertions", Json::array()).empty();
    }
    if (!project || !source || !live) {
        auto &choices = schema["properties"]["tool"]["enum"];
        choices.erase(std::find(choices.begin(), choices.end(), Json("finish")));
    }
    if(project){auto &choices=schema["properties"]["tool"]["enum"];choices.erase(std::find(choices.begin(),choices.end(),Json("project_instructions")));}
    if(listed){auto &choices=schema["properties"]["tool"]["enum"];choices.erase(std::find(choices.begin(),choices.end(),Json("source_list")));}
    return schema;
}
Json gemini_schema(const Json &context) {
    const auto base = decision_schema(context);
    Json branches = Json::array();
    for (const auto &choice : base.at("properties").at("tool").at("enum")) {
        const auto tool = choice.get<std::string>();
        auto branch = base;
        auto &properties = branch["properties"];
        properties["tool"]["enum"] = Json::array({tool});
        for (const auto &field : {"path", "query", "status", "verdict"}) {
            const std::string name = field;
            const bool used =
                (name == "path" && tool == "source_read") ||
                (name == "query" && tool == "source_search") ||
                (name == "status" && (tool == "browser_observe" || tool == "api_observe")) ||
                (name == "verdict" && tool == "finish");
            if (!used)
                properties[name]["enum"] = Json::array({""});
        }
        properties["evidence_ids"]["maxItems"] = tool == "finish" ? 12 : 0;
        branches.push_back(branch);
    }
    return {{"type", "object"},
            {"properties", {{"action", {{"anyOf", branches}}}}},
            {"required", Json::array({"action"})},
            {"additionalProperties", false}};
}
void validate_action(const Json &action) {
    const auto schema = action_schema();
    if (!action.is_object() || action.size() != schema.at("properties").size())
        throw Error(400, "Invalid action fields");
    for (auto it = schema.at("properties").begin(); it != schema.at("properties").end(); ++it) {
        if (!action.contains(it.key()))
            throw Error(400, "Missing action field");
        const auto &value = action.at(it.key());
        const auto type = it.value().at("type");
        if ((type == "string" && (!value.is_string() || value.get<std::string>().size() > 1500 ||
                                  value.get<std::string>().find('\0') != std::string::npos)) ||
            (type == "integer" && !value.is_number_integer()) ||
            (type == "array" && !value.is_array()))
            throw Error(400, "Invalid action field type or length");
        if (it.value().contains("enum") &&
            std::find(it.value().at("enum").begin(), it.value().at("enum").end(), value) ==
                it.value().at("enum").end())
            throw Error(403, "Tool or enum denied");
    }
    if (action.at("start_line").get<int64_t>() < 1 ||
        action.at("start_line").get<int64_t>() > 10000 || action.at("limit").get<int64_t>() < 1 ||
        action.at("limit").get<int64_t>() > 160)
        throw Error(400, "Source line range denied");
    if (action.at("evidence_ids").size() > 12)
        throw Error(400, "Too many evidence references");
    for (const auto &id : action.at("evidence_ids"))
        if (!id.is_string() || !std::regex_match(id.get<std::string>(), std::regex("[a-f0-9]{32}")))
            throw Error(400, "Invalid evidence ID");
    const std::string tool = action.at("tool"), path = action.at("path"),
                      query = action.at("query"), status = action.at("status"),
                      verdict = action.at("verdict");
    if (tool == "source_read") {
        if (!std::regex_match(
                path, std::regex(R"((src|static)/[A-Za-z0-9_./-]+\.(cpp|hpp|js|html|css))")) ||
            path.find("..") != std::string::npos)
            throw Error(403, "Source path denied");
    } else if (!path.empty())
        throw Error(400, "Unexpected path argument");
    if (tool == "source_search") {
        if (query.empty() || query.size() > 100)
            throw Error(400, "Search query limit");
    } else if (!query.empty())
        throw Error(400, "Unexpected search argument");
    if (tool != "api_observe" && tool != "browser_observe" && !status.empty())
        throw Error(400, "Unexpected filter argument");
    if (tool == "finish") {
        if (verdict.empty() || action.at("summary").get<std::string>().empty())
            throw Error(400, "Finish needs a verdict and summary");
    } else if (!verdict.empty() || !action.at("evidence_ids").empty())
        throw Error(400, "Unexpected conclusion argument");
}
ModelReply parse_model_reply(const Json &response) {
    if (response.value("status", std::string()) != "completed")
        throw Error(502, "Model response incomplete or refused");
    Json calls = Json::array();
    for (const auto &item : response.at("output"))
        if (item.value("type", std::string()) == "function_call")
            calls.push_back(item);
    if (calls.size() != 1 || calls[0].value("name", std::string()) != "next_action")
        throw Error(502, "Expected exactly one next_action call");
    const auto arguments = calls[0].at("arguments").get<std::string>();
    if (arguments.size() > 5000)
        throw Error(502, "Model action exceeds limit");
    auto action =
        Json::parse(arguments); // Policy validation occurs after persistence in the worker.
    const auto &usage = response.at("usage");
    const auto input = usage.at("input_tokens").get<int>(),
               output = usage.at("output_tokens").get<int>();
    if (input < 0 || output < 0)
        throw Error(502, "Invalid provider usage");
    return {action, input, output, response.value("id", std::string())};
}
ModelReply openai_decide(const Json &config, const Json &context, const std::string &instructions,
                         const Json &images) {
    Json content = Json::array({{{"type", "input_text"}, {"text", context.dump()}}});
    for (const auto &image : images)
        content.push_back({{"type", "input_image"}, {"image_url", image}, {"detail", "low"}});
    Json request = {
        {"model", config.at("model")},
        {"instructions", instructions},
        {"store", false},
        {"input", Json::array({{{"role", "user"}, {"content", content}}})},
        {"tools",
         Json::array({{{"type", "function"},
                       {"name", "next_action"},
                       {"description",
                        "Propose one scoped read-only action or a cited investigation conclusion"},
                       {"strict", true},
                       {"parameters", context.value("mode", std::string()) == "repair"
                                          ? repair_schema()
                                          : decision_schema(context)}}})},
        {"tool_choice", {{"type", "function"}, {"name", "next_action"}}},
        {"parallel_tool_calls", false},
        {"max_output_tokens", 1536}};
    const auto response = provider_http(config, L"POST", L"/v1/responses", request.dump());
    if (response.value("model", std::string()) != config.at("model").get<std::string>())
        throw Error(502, "Provider model identity differs from the configured snapshot");
    return parse_model_reply(response);
}
ModelReply parse_gemini_reply(const Json &response, const std::string &model) {
    if (response.value("modelVersion", std::string()) != model)
        throw Error(502, "Gemini model identity differs from the configured model");
    const auto &candidates = response.at("candidates");
    if (!candidates.is_array() || candidates.size() != 1 ||
        candidates[0].value("finishReason", std::string()) != "STOP")
        throw Error(502, "Expected one complete Gemini candidate");
    std::string text;
    for (const auto &part : candidates[0].at("content").at("parts")) {
        if (part.value("thought", false))
            continue;
        if (!part.contains("text") || !part.at("text").is_string())
            throw Error(502, "Unexpected Gemini output part");
        text += part.at("text").get<std::string>();
        if (text.size() > 5000)
            throw Error(502, "Gemini action exceeds limit");
    }
    const auto &usage = response.at("usageMetadata");
    const int input = usage.at("promptTokenCount").get<int>();
    const int candidates_tokens = usage.at("candidatesTokenCount").get<int>();
    const int thoughts = usage.value("thoughtsTokenCount", 0);
    const int total = usage.at("totalTokenCount").get<int>();
    if (input < 0 || candidates_tokens < 0 || thoughts < 0 || total < input ||
        static_cast<int64_t>(total) - input < static_cast<int64_t>(candidates_tokens) + thoughts)
        throw Error(502, "Invalid Gemini usage");
    // Conservatively count all non-input tokens, including thinking, as output.
    const auto envelope = Json::parse(text);
    if (!envelope.is_object() || envelope.size() != 1 || !envelope.contains("action"))
        throw Error(502, "Expected one Gemini action envelope");
    return {envelope.at("action"), input, total - input,
            response.value("responseId", std::string())};
}
ModelReply model_decide(const Json &config, const Json &context, const std::string &instructions,
                        const Json &images) {
    if (config.value("provider", std::string()) == "openai")
        return openai_decide(config, context, instructions, images);
    if (config.value("provider", std::string()) != "gemini")
        throw Error(400, "Unsupported model provider");
    const auto model = config.at("model").get<std::string>();
    if (!std::regex_match(model, std::regex("[A-Za-z0-9._-]{1,128}")))
        throw Error(400, "Invalid model identifier");
    Json parts = Json::array({{{"text", context.dump()}}});
    for (const auto &image : images) {
        const auto data = image.get<std::string>();
        const auto separator = data.find(";base64,");
        if (separator == std::string::npos || (data.substr(0, separator) != "data:image/png" &&
                                               data.substr(0, separator) != "data:image/jpeg"))
            throw Error(400, "Unsupported investigator image encoding");
        parts.push_back({{"inlineData",
                          {{"mimeType", data.substr(5, separator - 5)},
                           {"data", data.substr(separator + 8)}}}});
    }
    Json request = {{"systemInstruction", {{"parts", Json::array({{{"text", instructions}}})}}},
                    {"contents", Json::array({{{"role", "user"}, {"parts", parts}}})},
                    {"generationConfig",
                     {{"candidateCount", 1},
                      {"maxOutputTokens", 1536},
                      {"responseMimeType", "application/json"},
                      {"responseJsonSchema",
                       context.value("mode", std::string()) == "repair"
                           ? repair_gemini_schema(context.value("execution_available", true),context.value("profile",std::string("frontend")))
                           : gemini_schema(context)}}}};
    const std::wstring path =
        L"/v1beta/models/" + std::wstring(model.begin(), model.end()) + L":generateContent";
    return parse_gemini_reply(provider_http(config, L"POST", path.c_str(), request.dump()), model);
}
namespace {
Json provider_http(const Json &config, const wchar_t *method, const wchar_t *path,
                   const std::string &payload) {
    const auto key = config.at("api_key").get<std::string>();
    if (key.empty() || key.size() > 512 ||
        std::any_of(key.begin(), key.end(), [](unsigned char c) { return c <= 32 || c >= 127; }))
        throw Error(503, "Configure an API key locally; never send it through chat");
    Internet session, connection, call;
    session.handle = WinHttpOpen(L"DevDesk/phase3", WINHTTP_ACCESS_TYPE_NO_PROXY,
                                 WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    network_check(session.handle);
    network_check(WinHttpSetTimeouts(session.handle, 5000, 5000, 10000, 90000));
    const auto provider = config.value("provider", std::string());
    if (provider != "openai" && provider != "gemini")
        throw Error(400, "Unsupported model provider");
    connection.handle = WinHttpConnect(session.handle,
                                       provider == "gemini" ? L"generativelanguage.googleapis.com"
                                                            : L"api.openai.com",
                                       INTERNET_DEFAULT_HTTPS_PORT, 0);
    network_check(connection.handle);
    call.handle = WinHttpOpenRequest(connection.handle, method, path, nullptr, WINHTTP_NO_REFERER,
                                     WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE);
    network_check(call.handle);
    DWORD redirects = WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    network_check(WinHttpSetOption(call.handle, WINHTTP_OPTION_REDIRECT_POLICY, &redirects,
                                   sizeof redirects));
    const std::string raw_headers =
        std::string("Content-Type: application/json\r\n") +
        (provider == "gemini" ? "x-goog-api-key: " : "Authorization: Bearer ") + key + "\r\n";
    const std::wstring headers(raw_headers.begin(), raw_headers.end());
    network_check(
        WinHttpSendRequest(call.handle, headers.c_str(), static_cast<DWORD>(headers.size()),
                           const_cast<char *>(payload.data()), static_cast<DWORD>(payload.size()),
                           static_cast<DWORD>(payload.size()), 0));
    network_check(WinHttpReceiveResponse(call.handle, nullptr));
    DWORD status = 0, length = sizeof status;
    network_check(WinHttpQueryHeaders(
        call.handle, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        WINHTTP_HEADER_NAME_BY_INDEX, &status, &length, WINHTTP_NO_HEADER_INDEX));
    if (status != 200)
        throw Error(503, "Provider rejected request (HTTP " + std::to_string(status) +
                             "); no automatic retry of a potentially billed request");
    std::string response;
    while (true) {
        DWORD available = 0;
        network_check(WinHttpQueryDataAvailable(call.handle, &available));
        if (!available)
            break;
        if (response.size() + available > 100000)
            throw Error(502, "Provider response exceeds limit");
        std::vector<char> buffer(available);
        DWORD read = 0;
        network_check(WinHttpReadData(call.handle, buffer.data(), available, &read));
        response.append(buffer.data(), read);
    }
    return Json::parse(response);
}
} // namespace
int verify_model_access(const Json &config) {
    const auto provider = config.value("provider", std::string());
    if (provider != "openai" && provider != "gemini")
        throw Error(400, "Unsupported model provider");
    const auto model = config.at("model").get<std::string>();
    if (!std::regex_match(model, std::regex("[A-Za-z0-9._-]{1,128}")))
        throw Error(400, "Invalid model identifier");
    const std::wstring path = (provider == "gemini" ? L"/v1beta/models/" : L"/v1/models/") +
                              std::wstring(model.begin(), model.end());
    const auto response = provider_http(config, L"GET", path.c_str(), "");
    if ((provider == "gemini" &&
         (response.value("name", std::string()) != "models/" + model ||
          !response.contains("supportedGenerationMethods") ||
          std::find(response.at("supportedGenerationMethods").begin(),
                    response.at("supportedGenerationMethods").end(),
                    "generateContent") == response.at("supportedGenerationMethods").end())) ||
        (provider == "openai" && response.value("id", std::string()) != model))
        throw Error(502, "Provider did not confirm configured model access");
    std::cout
        << "Model access confirmed: " << model
        << ". GET only; structured/image decisions still need the live investigation check.\n";
    return 0;
}
int worker_selftest() {
    Json action = {{"tool", "source_read"},
                   {"path", "src/routes.cpp"},
                   {"query", ""},
                   {"status", ""},
                   {"start_line", 1},
                   {"limit", 80},
                   {"verdict", ""},
                   {"summary", "Read relevant code"},
                   {"evidence_ids", Json::array()}};
    validate_action(action);
    int passed = 1;
    for (const auto &mutation : Json::array({{{"tool", "patch"}},
                                             {{"path", "../../var/config/model.json"}},
                                             {{"path", "third_party/json.hpp"}},
                                             {{"path", "src/../static/app.js"}},
                                             {{"limit", 1000}},
                                             {{"url", "https://evil.example"}}})) {
        auto invalid = action;
        invalid.update(mutation);
        bool denied = false;
        try {
            validate_action(invalid);
        } catch (...) {
            denied = true;
        }
        if (!denied)
            return 1;
        ++passed;
    }
    Json response = {{"status", "completed"},
                     {"id", "synthetic_parser_test"},
                     {"output", Json::array({{{"type", "function_call"},
                                              {"name", "next_action"},
                                              {"arguments", action.dump()}}})},
                     {"usage", {{"input_tokens", 10}, {"output_tokens", 20}}}};
    if (parse_model_reply(response).input_tokens != 10)
        return 1;
    ++passed;
    response["output"].push_back(response["output"][0]);
    bool denied = false;
    try {
        parse_model_reply(response);
    } catch (...) {
        denied = true;
    }
    if (!denied)
        return 1;
    ++passed;
    Json gemini = {
        {"modelVersion", "gemini-3.5-flash-lite"},
        {"responseId", "synthetic_gemini_test"},
        {"candidates",
         Json::array(
             {{{"finishReason", "STOP"},
               {"content",
                {{"parts", Json::array({{{"text", Json({{"action", action}}).dump()}}})}}}}})},
        {"usageMetadata",
         {{"promptTokenCount", 10},
          {"candidatesTokenCount", 20},
          {"thoughtsTokenCount", 5},
          {"totalTokenCount", 35}}}};
    auto receipt = parse_gemini_reply(gemini, "gemini-3.5-flash-lite");
    if (receipt.action != action || receipt.output_tokens != 25 || receipt.input_tokens != 10)
        return 1;
    ++passed;
    for (const auto &mutation : Json::array({{{"modelVersion", "other-model"}},
                                             {{"candidates", Json::array()}},
                                             {{"usageMetadata",
                                               {{"promptTokenCount", 10},
                                                {"candidatesTokenCount", 20},
                                                {"totalTokenCount", 15}}}}})) {
        auto invalid = gemini;
        invalid.update(mutation);
        bool rejected = false;
        try {
            parse_gemini_reply(invalid, "gemini-3.5-flash-lite");
        } catch (...) {
            rejected = true;
        }
        if (!rejected)
            return 1;
        ++passed;
    }
    auto incomplete = gemini;
    incomplete["candidates"][0]["finishReason"] = "MAX_TOKENS";
    bool rejected = false;
    try {
        parse_gemini_reply(incomplete, "gemini-3.5-flash-lite");
    } catch (...) {
        rejected = true;
    }
    if (!rejected)
        return 1;
    ++passed;
    Json context = {{"observations", Json::array()}};
    if (decision_schema(context)["properties"]["tool"]["enum"].size() != 6)
        return 1;
    ++passed;
    for (const auto &tool : {"project_instructions", "source_read"})
        context["observations"].push_back(
            {{"tool", tool}, {"result", {{"assertions", Json::array()}}}});
    if (decision_schema(context)["properties"]["tool"]["enum"].size() != 5)
        return 1;
    ++passed;
    context["observations"].push_back(
        {{"tool", "browser_observe"},
         {"result", {{"assertions", Json::array({{{"result", "FAIL"}}})}}}});
    if (decision_schema(context)["properties"]["tool"]["enum"].size() != 6)
        return 1;
    ++passed;
    const auto variants = gemini_schema(context)["properties"]["action"]["anyOf"];
    if (variants.size() != 6)
        return 1;
    ++passed;
    for (const auto &variant : variants) {
        const auto tool = variant["properties"]["tool"]["enum"][0].get<std::string>();
        if (tool == "browser_observe") {
            if (variant["properties"]["path"]["enum"] != Json::array({""}) ||
                variant["properties"]["evidence_ids"]["maxItems"] != 0)
                return 1;
            ++passed;
        }
        if (tool == "finish") {
            if (variant["properties"]["evidence_ids"]["maxItems"] != 12)
                return 1;
            ++passed;
        }
    }
    context["observations"].push_back({{"tool","source_list"},{"result",{{"files",Json::array({"src/main.cpp"})}}}});
    if(decision_schema(context)["properties"]["tool"]["enum"].size()!=5)return 1;
    context["investigation_profile"]="backend";
    if(decision_schema(context)["properties"]["tool"]["enum"].size()!=4)return 1;
    ++passed;
    context["observations"].push_back({{"tool","api_observe"},{"result",{{"assertions",Json::array({{{"name","status_filter_exact"},{"result","FAIL"}}})}}}});
    if(decision_schema(context)["properties"]["tool"]["enum"].size()!=5)return 1;
    ++passed;
    std::cout << "Worker policy/provider parser self-checks: " << passed
              << " PASS (offline; zero model calls)\n";
    return 0;
}
} // namespace devdesk
