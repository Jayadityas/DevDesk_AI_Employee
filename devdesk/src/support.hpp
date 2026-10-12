#pragma once
#include "httplib.h"
#include "json.hpp"
#include <libpq-fe.h>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <regex>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>
namespace devdesk {
using Json = nlohmann::json;
struct Error : std::runtime_error {
    int status;
    Error(int s, const std::string &m) : runtime_error(m), status(s) {}
};
std::string random_hex(size_t bytes);
std::string hash(const std::string &value);
std::string password_hash(const std::string &password, const std::string &salt);
bool equal_secret(const std::string &a, const std::string &b);
Json read_json(const std::filesystem::path &file);
struct Result {
    PGresult *value;
    explicit Result(PGresult *p) : value(p) {}
    ~Result() {
        PQclear(value);
    }
    Result(const Result &) = delete;
    Result(Result &&other) noexcept : value(other.value) {
        other.value = nullptr;
    }
    int rows() const {
        return PQntuples(value);
    }
    std::string get(int row, const char *name) const {
        return PQgetvalue(value, row, PQfnumber(value, name));
    }
    bool null(int row, const char *name) const {
        return PQgetisnull(value, row, PQfnumber(value, name));
    }
    Json json() const;
};
class Database {
    PGconn *connection;

  public:
    std::mutex mutex;
    explicit Database(const Json &config);
    ~Database() {
        PQfinish(connection);
    }
    Result query(const std::string &sql, const std::vector<std::string> &parameters = {});
};
struct Transaction {
    Database &db;
    bool committed = false;
    explicit Transaction(Database &d) : db(d) {
        db.query("BEGIN");
    }
    void commit() {
        db.query("COMMIT");
        committed = true;
    }
    ~Transaction() {
        if (!committed)
            try {
                db.query("ROLLBACK");
            } catch (...) {
            }
    }
};
struct ImageInfo {
    std::string mime;
    unsigned width, height;
};
ImageInfo decode_image(const std::string &content);
void seed(Database &db, const std::filesystem::path &account_file);
void install_routes(httplib::Server &server, Database &db, const Json &config, int port);
} // namespace devdesk
