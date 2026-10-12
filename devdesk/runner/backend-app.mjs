// Executed by fixed Docker exec as application UID 10001, never evaluator UID.
import fs from 'node:fs/promises';import {spawn,execFileSync} from 'node:child_process';
if(process.getuid()!==10001)throw Error('Wrong application user');
await fs.mkdir('/tmp/app-data',{recursive:true,mode:0o755});
execFileSync('/tmp/team-tasks',['--db','/tmp/app-data/tasks.db','--seed'],{timeout:5000});
const app=spawn('/tmp/team-tasks',['--db','/tmp/app-data/tasks.db','--static','/tmp/task/static','--port','8080','--scenario','backend-candidate'],{stdio:'ignore'});
app.once('exit',code=>process.exit(code||1));
