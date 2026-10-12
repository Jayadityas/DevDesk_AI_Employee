#pragma once
#include "support.hpp"
namespace devdesk {
Json action_schema();
Json decision_schema(const Json &context);
Json gemini_schema(const Json &context);
void validate_action(const Json &action);
struct ModelReply {
    Json action;
    int input_tokens = 0, output_tokens = 0;
    std::string request_id;
};
ModelReply parse_model_reply(const Json &response);
ModelReply parse_gemini_reply(const Json &response, const std::string &model);
ModelReply model_decide(const Json &config, const Json &context, const std::string &instructions,
                        const Json &images);
int verify_model_access(const Json &config);
ModelReply openai_decide(const Json &config, const Json &context, const std::string &instructions,
                         const Json &images);
int run_worker(Database &db, const Json &runtime, const Json &model,
               const std::filesystem::path &root, bool test_mode);
int worker_selftest();
} // namespace devdesk
