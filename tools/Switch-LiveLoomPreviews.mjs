// Switch only verified DevDesk-owned preview pairs; application source/data remain untouched.
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,'')),demo=await load(path.join(root,'var/evidence/live-loom-latest.json')),restore=process.argv.includes('--restore'),from=restore?demo.directory:(demo.previous_directory||root),to=restore?root:demo.directory;
if(from!==root&&!path.resolve(from).startsWith(path.join(root,'var')+path.sep))throw Error('Previous preview workspace must stay under workspace var');
const docker=args=>execFileSync('C:/Program Files/Docker/Docker/resources/bin/docker.exe',args,{encoding:'utf8',windowsHide:true,timeout:20000});
for(const name of ['preview.json','preview-backend.json','preview-feature.json']){
 const state=await load(path.join(from,'var/config',name)).catch(()=>null);if(!state)continue;
 for(const id of [state.container_id,state.relay_id]){let c;try{c=JSON.parse(docker(['inspect',id]))[0];}catch{continue;}if(c.Config.Labels?.['devdesk.workspace']!==from||!['frontend-preview','frontend-preview-relay'].includes(c.Config.Labels?.['devdesk.role']))throw Error('Preview ownership differs; container preserved');docker(['rm','-f',id]);}
}
const release=(await load(path.join(to,'devdesk/build/latest.json'))).directory;
execFileSync(path.join(release,'devdesk.exe'),['--activate-preview',path.join(to,'var/config/workbench.json'),to],{encoding:'utf8',windowsHide:true,timeout:360000,stdio:'inherit'});
console.log(restore?'Accepted original-workspace previews restored.':'Original-defect recording previews active.');
