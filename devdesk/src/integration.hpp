#pragma once
#include "repair.hpp"
namespace devdesk {
Json prepare_review(Database &db,const std::string &employee,const std::string &repair);
Json decide_review(Database &db,const std::string &employee,const std::string &review,const Json &body);
int run_integration(Database &db,const Json &runtime,const std::filesystem::path &root);
}
