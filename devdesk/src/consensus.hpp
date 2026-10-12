#pragma once
#include "support.hpp"
namespace devdesk {
void open_feature_poll(Database &db,const std::string &proposal);
Json feature_poll_detail(Database &db,const std::string &ticket);
Json cast_feature_vote(Database &db,const std::string &employee,const std::string &poll,const Json &input);
void reconcile_feature_polls(Database &db);
void require_feature_consensus(Database &db,const std::string &proposal);
}
