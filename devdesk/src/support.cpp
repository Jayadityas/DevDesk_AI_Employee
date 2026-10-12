#include "support.hpp"
#include <windows.h>
#include <bcrypt.h>
#include <memory>
namespace devdesk {
namespace {
std::string hex(const std::vector<unsigned char> &bytes) {
    const char *alphabet = "0123456789abcdef";
    std::string out;
    for (auto byte : bytes) {
        out += alphabet[byte >> 4];
        out += alphabet[byte & 15];
    }
    return out;
}
void crypto_check(NTSTATUS result) {
    if (result < 0)
        throw std::runtime_error("Cryptography operation failed");
}
struct Algorithm {
    BCRYPT_ALG_HANDLE handle = nullptr;
    ~Algorithm() {
        if (handle)
            BCryptCloseAlgorithmProvider(handle, 0);
    }
};
} // namespace
std::string random_hex(size_t count) {
    std::vector<unsigned char> bytes(count);
    crypto_check(BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(count),
                                 BCRYPT_USE_SYSTEM_PREFERRED_RNG));
    return hex(bytes);
}
std::string hash(const std::string &input) {
    Algorithm algorithm;
    crypto_check(
        BCryptOpenAlgorithmProvider(&algorithm.handle, BCRYPT_SHA256_ALGORITHM, nullptr, 0));
    std::vector<unsigned char> out(32);
    crypto_check(BCryptHash(algorithm.handle, nullptr, 0,
                            reinterpret_cast<PUCHAR>(const_cast<char *>(input.data())),
                            static_cast<ULONG>(input.size()), out.data(), 32));
    return hex(out);
}
std::string password_hash(const std::string &password, const std::string &salt) {
    Algorithm algorithm;
    crypto_check(BCryptOpenAlgorithmProvider(&algorithm.handle, BCRYPT_SHA256_ALGORITHM, nullptr,
                                             BCRYPT_ALG_HANDLE_HMAC_FLAG));
    std::vector<unsigned char> out(32);
    crypto_check(BCryptDeriveKeyPBKDF2(
        algorithm.handle, reinterpret_cast<PUCHAR>(const_cast<char *>(password.data())),
        static_cast<ULONG>(password.size()),
        reinterpret_cast<PUCHAR>(const_cast<char *>(salt.data())), static_cast<ULONG>(salt.size()),
        600000, out.data(), 32, 0));
    return hex(out);
}
bool equal_secret(const std::string &a, const std::string &b) {
    if (a.size() != b.size())
        return false;
    unsigned difference = 0;
    for (size_t i = 0; i < a.size(); ++i)
        difference |= static_cast<unsigned char>(a[i] ^ b[i]);
    return difference == 0;
}
Json read_json(const std::filesystem::path &file) {
    std::ifstream stream(file, std::ios::binary);
    if (!stream)
        throw std::runtime_error("Local configuration file unavailable");
    return Json::parse(stream);
}
Json Result::json() const {
    Json output = Json::array();
    for (int row = 0; row < rows(); ++row) {
        Json item = Json::object();
        for (int col = 0; col < PQnfields(value); ++col) {
            const std::string name = PQfname(value, col);
            if (PQgetisnull(value, row, col))
                item[name] = nullptr;
            else
                item[name] = PQgetvalue(value, row, col);
        }
        output.push_back(item);
    }
    return output;
}
Database::Database(const Json &config) {
    connection = PQconnectdb(config.at("dsn").get<std::string>().c_str());
    if (PQstatus(connection) != CONNECTION_OK) {
        PQfinish(connection);
        throw std::runtime_error(
            "PostgreSQL connection failed; check local configuration and dedicated server");
    }
    const auto schema = config.value("schema", std::string("public"));
    if (!std::regex_match(schema, std::regex("[a-z][a-z0-9_]{0,62}"))) {
        PQfinish(connection);
        throw std::runtime_error("Invalid database schema configuration");
    }
    query("SET search_path TO " + schema);
    query("SET statement_timeout TO '5s'");
}
Result Database::query(const std::string &sql, const std::vector<std::string> &parameters) {
    std::vector<const char *> pointers;
    for (const auto &value : parameters)
        pointers.push_back(value.c_str());
    Result result(PQexecParams(connection, sql.c_str(), static_cast<int>(pointers.size()), nullptr,
                               pointers.data(), nullptr, nullptr, 0));
    if (!result.value || (PQresultStatus(result.value) != PGRES_TUPLES_OK &&
                          PQresultStatus(result.value) != PGRES_COMMAND_OK)) {
        throw std::runtime_error("Database operation failed");
    }
    return result;
}
void seed(Database &db, const std::filesystem::path &file) {
    Json accounts;
    if (std::filesystem::exists(file))
        accounts = read_json(file);
    else {
        accounts = Json::array();
        for (const auto &pair :
             std::vector<std::pair<std::string, std::string>>{{"asha", "Asha"},
                                                              {"ravi", "Ravi"},
                                                              {"maya", "Maya"},
                                                              {"noah", "Noah"},
                                                              {"outsider", "Guest"}})
            accounts.push_back(
                {{"username", pair.first}, {"name", pair.second}, {"password", random_hex(16)}});
        std::filesystem::create_directories(file.parent_path());
        std::ofstream output(file);
        output << accounts.dump(2);
        output.close();
        if (!output)
            throw std::runtime_error("Cannot save synthetic account file");
    }
    Transaction transaction(db);
    for (const auto &account : accounts) {
        const auto salt = random_hex(16);
        auto row =
            db.query("INSERT INTO employees(username,name,salt,password_hash) VALUES($1,$2,$3,$4) "
                     "ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                     {account.at("username"), account.at("name"), salt,
                      password_hash(account.at("password"), salt)});
        if (account.at("username") != "outsider")
            db.query("INSERT INTO memberships(employee_id,project_id) VALUES($1,1) ON CONFLICT DO "
                     "NOTHING",
                     {row.get(0, "id")});
    }
    transaction.commit();
}
} // namespace devdesk
