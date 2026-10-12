// Fixed build recipe outside the editable checkout.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
export async function buildTask(){
 await fs.mkdir('/tmp/task',{recursive:true});
 for(const folder of ['src','static','third_party'])await fs.cp(`/input/${folder}`,`/tmp/task/${folder}`,{recursive:true,dereference:false});
 const files=[];
 async function collect(folder){for(const entry of await fs.readdir(`/tmp/task/${folder}`,{withFileTypes:true})){const name=`${folder}/${entry.name}`;if(entry.isSymbolicLink())throw new Error('Source link denied');if(entry.isDirectory())await collect(name);else files.push(name);}}
 for(const folder of ['src','static','third_party'])await collect(folder);
 files.sort((a,b)=>a.localeCompare(b,'en-US',{sensitivity:'base'}));
 const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const fingerprint=[];for(const name of files)fingerprint.push(`\\${name.replaceAll('/','\\')}:${digest(await fs.readFile(`/tmp/task/${name}`)).toUpperCase()}`);
 const profile=process.env.DEVDESK_PROFILE||'frontend',file=profile==='backend'?'src/task_repository.cpp':profile==='feature'?'static/index.html':'static/styles.css';
 if(!['frontend','backend','feature'].includes(profile))throw Error('Unregistered build profile');
 const identity={base_commit:process.env.DEVDESK_BASE_COMMIT,source_sha256:digest(Buffer.from(fingerprint.join('\n'))),css_sha256:digest(await fs.readFile('/tmp/task/static/styles.css')),profile,file_sha256:digest(await fs.readFile(`/tmp/task/${file}`))};
 if(!/^[a-f0-9]{40}$/.test(identity.base_commit)||identity.css_sha256!==process.env.DEVDESK_CSS_SHA256)throw new Error('Build source identity mismatch');
 if(process.env.DEVDESK_FILE_SHA256&&identity.file_sha256!==process.env.DEVDESK_FILE_SHA256)throw Error('Approved file identity mismatch');
 await fs.writeFile('/tmp/task/src/build_identity.hpp',`#pragma once\n#define PLAYGROUND_COMMIT "${identity.base_commit}"\n#define PLAYGROUND_BUILD "${identity.source_sha256}"\n`);
 const sources=(await fs.readdir('/tmp/task/src')).filter(n=>n.endsWith('.cpp')).map(n=>`/tmp/task/src/${n}`);
 execFileSync('g++',['-std=c++20','-O0','-pthread','-I/tmp/task/src','-I/tmp/task/third_party',...sources,'-lsqlite3','-o','/tmp/team-tasks'],{timeout:65000,maxBuffer:100000});
 return identity;
}
