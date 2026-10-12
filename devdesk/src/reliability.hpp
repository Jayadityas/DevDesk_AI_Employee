#pragma once
#include "support.hpp"
#include <atomic>
#include <condition_variable>
#include <thread>
#include <windows.h>
namespace devdesk {
class WorkerLease {
 Database &db;
 Json config;
 std::filesystem::path root;
 HANDLE lock_handle=INVALID_HANDLE_VALUE;
 std::string token,kind,schema,fence;
 std::atomic_bool healthy{true};
 std::jthread heartbeat;
 std::condition_variable_any wake;
 void write_capability(bool active);
public:
 WorkerLease(Database &database,const Json &runtime,const std::filesystem::path &workspace,const std::string &worker_kind);
 ~WorkerLease();
 WorkerLease(const WorkerLease&)=delete;
 void attach(const std::string &table,const std::string &run);
 void ensure(const std::string &ticket="",bool allow_cancel=false);
 void bind_job(Json &job,const std::string &ticket) const;
};
std::filesystem::path runtime_root();
std::filesystem::path runtime_release();
bool cancellation_requested(Database &db,const std::string &ticket);
void record_notice(Database &db,const std::string &ticket,const std::string &key,const std::string &message);
int recover_work(Database &db,const Json &runtime,const std::filesystem::path &root);
int activate_preview(Database &db,const Json &runtime,const std::filesystem::path &root);
void reconcile_work(Database &db,const std::filesystem::path &root);
void mark_cancellation(const Json &runtime,const std::string &ticket);
}
