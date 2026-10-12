#include "support.hpp"
#include "worker.hpp"
#include "repair.hpp"
#include "integration.hpp"
#include "reliability.hpp"
#include <chrono>
#include <thread>
#include <iostream>
int main(int argc, char **argv) {
    try {
        if (argc == 2 && std::string(argv[1]) == "--worker-selftest")
            return devdesk::worker_selftest();
        if (argc == 2 && std::string(argv[1]) == "--repair-selftest")
            return devdesk::repair_selftest();
        if (argc == 3 && std::string(argv[1]) == "--model-access")
            return devdesk::verify_model_access(devdesk::read_json(argv[2]));
        if (argc < 3) {
            std::cerr << "Usage: devdesk --seed config accounts | --serve config port static\n";
            return 2;
        }
        const auto config = devdesk::read_json(argv[2]);
        devdesk::Database db(config);
        if(std::string(argv[1])=="--recover"&&argc==4)
            return devdesk::recover_work(db,config,std::filesystem::canonical(argv[3]));
        if(std::string(argv[1])=="--activate-preview"&&argc==4)
            return devdesk::activate_preview(db,config,std::filesystem::canonical(argv[3]));
        if(std::string(argv[1])=="--test-hold-lease"&&argc==5){
            if(!std::regex_match(config.at("schema").get<std::string>(),std::regex("test_[a-f0-9]{32}")))throw devdesk::Error(403,"Lease test requires fresh test schema");
            int seconds=std::stoi(argv[4]);if(seconds<1||seconds>60)throw devdesk::Error(400,"Invalid bounded lease test");
            devdesk::WorkerLease lease(db,config,std::filesystem::canonical(argv[3]),"test_hold");
            std::cout<<"Lease held\n"<<std::flush;std::this_thread::sleep_for(std::chrono::seconds(seconds));lease.ensure();return 0;
        }
        if(std::string(argv[1])=="--integrate"&&argc==4)
            return devdesk::run_integration(db,config,std::filesystem::canonical(argv[3]));
        if ((std::string(argv[1]) == "--repair" || std::string(argv[1]) == "--test-repair" ||
             std::string(argv[1]) == "--patch-only") &&
            argc == 5)
            return devdesk::run_repair(
                db, config, devdesk::read_json(argv[3]), std::filesystem::canonical(argv[4]),
                std::string(argv[1]) == "--test-repair", std::string(argv[1]) == "--patch-only");
        if ((std::string(argv[1]) == "--worker" || std::string(argv[1]) == "--test-worker") &&
            argc == 5) {
            return devdesk::run_worker(db, config, devdesk::read_json(argv[3]),
                                       std::filesystem::canonical(argv[4]),
                                       std::string(argv[1]) == "--test-worker");
        }
        if (std::string(argv[1]) == "--seed" && argc == 4) {
            devdesk::seed(db, argv[3]);
            std::cout
                << "Synthetic accounts seeded; passwords are in the ignored local account file.\n";
            return 0;
        }
        if (std::string(argv[1]) != "--serve" || argc != 5)
            return 2;
        const int port = std::stoi(argv[3]);
        if (port < 1024 || port > 65535)
            return 2;
        httplib::Server server;
        server.new_task_queue = []() { return new httplib::ThreadPool(4); };
        server.set_payload_max_length(6 * 1024 * 1024);
        server.set_read_timeout(10, 0);
        server.set_write_timeout(10, 0);
        devdesk::install_routes(server, db, config, port);
        if (!server.set_mount_point("/", argv[4]))
            throw std::runtime_error("Static directory unavailable");
        std::cout << "DevDesk workbench: http://127.0.0.1:" << port
                  << " (Phase 5; approved repair and accepted integration)\n"
                  << std::flush;
        return server.listen("127.0.0.1", port) ? 0 : 1;
    } catch (const devdesk::Error &error) {
        std::cerr << error.what() << '\n';
        return 1;
    } catch (const std::exception &) {
        std::cerr << "Workbench startup failed. Check local configuration, database and build. "
                     "Credentials withheld.\n";
        return 1;
    }
}
