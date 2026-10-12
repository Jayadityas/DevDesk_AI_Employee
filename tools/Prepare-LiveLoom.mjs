// New original-defect workspace and empty schema for user-operated live recording.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,'')),pkg=await load(path.join(root,'var/packages/latest.json')),sourceRelease=(await load(path.join(root,'devdesk/build/latest.json'))).directory;
const previous=await load(path.join(root,'var/evidence/live-loom-latest.json')).catch(()=>null);
const directory=path.join(root,'var/live-loom-'+Date.now());await fs.cp(pkg.directory,directory,{recursive:true});
await fs.cp(path.join(root,'tools/node_modules'),path.join(directory,'tools/node_modules'),{recursive:true});
function command(file,args){const r=spawnSync(file,args,{cwd:directory,windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error('Live demo preparation failed; sensitive output withheld');return r.stdout.trim();}
command('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(directory,'tools/Restore-PackagedFixtures.ps1'),'-Baseline']);
for(const profile of ['frontend','backend','feature'])await fs.mkdir(path.join(directory,'var/fixtures',profile,'build'),{recursive:true});
const release=path.join(directory,'devdesk/build/releases',path.basename(sourceRelease));await fs.cp(sourceRelease,release,{recursive:true});await fs.writeFile(path.join(directory,'devdesk/build/latest.json'),JSON.stringify({directory:release},null,2));
const evidence=path.join(root,'var/evidence/live-loom-'+Date.now());await fs.mkdir(evidence,{recursive:true});command('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/Setup-Phase2Test.ps1'),'-RunDirectory',evidence]);
const config=await load(path.join(evidence,'test-config.json'));config.uploads=path.join(directory,'var/uploads');await fs.mkdir(path.join(directory,'var/config'),{recursive:true});await fs.writeFile(path.join(directory,'var/config/workbench.json'),JSON.stringify(config,null,2));
await fs.copyFile(path.join(root,'var/config/model.json'),path.join(directory,'var/config/model.json'));
const originalRunner=await load(path.join(root,'var/config/runner.json'));await fs.writeFile(path.join(directory,'var/config/runner.json'),JSON.stringify({image:originalRunner.image,version:originalRunner.version,verified:false,backend_verified:false,feature_verified:false},null,2));
command(path.join(release,'devdesk.exe'),['--seed',path.join(directory,'var/config/workbench.json'),path.join(directory,'var/config/demo-accounts.json')]);
let workers=await fs.readFile(path.join(root,'tools/Start-Workers.ps1'),'utf8');workers=workers.replace("& (Join-Path $PSScriptRoot 'Setup-DevDeskPostgres.ps1')","# Live recording uses the existing configured cluster and its isolated schema.");await fs.writeFile(path.join(directory,'tools/Start-LiveWorkers.ps1'),workers);
await fs.writeFile(path.join(root,'var/evidence/live-loom-latest.json'),JSON.stringify({directory,release,config:path.join(directory,'var/config/workbench.json'),accounts:path.join(directory,'var/config/demo-accounts.json'),original_root:root,previous_directory:previous?.directory||root},null,2));
console.log(JSON.stringify({directory:path.relative(root,directory),empty_live_schema:true,original_defects_restored:true,new_model_calls:0}));
