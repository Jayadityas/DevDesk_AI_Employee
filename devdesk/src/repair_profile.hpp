#pragma once
#include "support.hpp"
namespace devdesk {
struct RepairProfile {std::string name,file,baseline_failure;};
inline RepairProfile repair_profile(const std::string &name){
 if(name=="frontend")return {name,"static/styles.css","action_buttons_separate_390"};
 if(name=="feature")return {name,"static/index.html","completed_filter_390"};
 if(name=="backend")return {name,"src/task_repository.cpp","filter_todo"};
 throw Error(403,"Unregistered repair profile");
}
inline std::set<std::string> mandatory_checks(const std::string &profile){
 repair_profile(profile);
 std::set<std::string> required={"build","app_source_identity","seeded_tasks","filter_todo","filter_in_progress","filter_done","action_buttons_separate_390","no_horizontal_overflow_390","no_script_errors_390","browser_create_390","browser_advance_390","browser_remove_390","action_buttons_separate_1280","no_horizontal_overflow_1280","no_script_errors_1280","browser_create_1280","browser_advance_1280","browser_remove_1280","create_task","advance_task"};
 if(profile=="feature")for(const auto &name:{"completed_filter_390","completed_filter_1280"})required.insert(name);
 if(profile=="backend")for(const auto &name:{"evaluator_user_separated","seed_matches_database","filter_matches_database","filter_after_mutations","invalid_filter_rejected","database_preserved_by_reads"})required.insert(name);
 return required;
}
}
