#pragma once
#include "worker.hpp"
#include "repair_profile.hpp"
namespace devdesk {
Json repair_schema();
Json repair_gemini_schema(bool execution_available = true, const std::string &profile = "frontend");
void validate_repair_action(const Json &action, const std::string &profile = "frontend");
int repair_selftest();
Json repair_helper(const std::filesystem::path &release, const std::filesystem::path &directory,
                   const Json &job);
int run_repair(Database &db, const Json &runtime, const Json &model,
               const std::filesystem::path &root, bool test_mode, bool patch_only = false);
} // namespace devdesk
