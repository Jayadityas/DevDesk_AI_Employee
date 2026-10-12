// Fixed read-only oracle compiled into the trusted image, outside editable source.
#include <sqlite3.h>
#include <iostream>
int main(){
 sqlite3 *db=nullptr;sqlite3_stmt *query=nullptr;
 if(sqlite3_open_v2("/tmp/app-data/tasks.db",&db,SQLITE_OPEN_READONLY,nullptr)!=SQLITE_OK){if(db)sqlite3_close(db);return 1;}
 const char *sql="SELECT json_group_array(json_object('id',id,'title',title,'description',description,'status',status,'created_at',created_at)) FROM (SELECT id,title,description,status,created_at FROM tasks ORDER BY id)";
 if(sqlite3_prepare_v2(db,sql,-1,&query,nullptr)!=SQLITE_OK){sqlite3_close(db);return 2;}
 int result=sqlite3_step(query);if(result==SQLITE_ROW){const auto *text=sqlite3_column_text(query,0);if(text)std::cout<<text;}
 sqlite3_finalize(query);sqlite3_close(db);return result==SQLITE_ROW?0:3;
}
