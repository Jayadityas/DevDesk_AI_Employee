// Fixed deployment recipe. Model actions cannot select mounts, ports or commands.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import net from 'node:net';import {execFileSync} from 'node:child_process';import {checkControl} from './control-contract.mjs';
const dockerExe='C:/Program Files/Docker/Docker/resources/bin/docker.exe',gitExe='C:/Program Files/Git/cmd/git.exe';
const load=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
function docker(args){try{return execFileSync(dockerExe,args,{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:100000});}catch(error){throw new Error(`Preview Docker ${args[0]} failed: ${String(error.stderr||error.message).trim().slice(0,180)}`);}}
export async function sourceIdentity(root,profile='frontend'){
 if(!['frontend','backend','feature'].includes(profile))throw Error('Unregistered preview profile');
 const source=path.join(root,'var/fixtures',profile);
 const git=args=>execFileSync(gitExe,['-c',`safe.directory=${source}`,'-c','core.fsmonitor=false','-C',source,...args],{encoding:'utf8',windowsHide:true,timeout:5000}).trim();
 if(git(['status','--porcelain']))throw new Error('Shared preview source has uncommitted changes');
 const files=[];async function collect(folder){for(const entry of await fs.readdir(path.join(source,folder),{withFileTypes:true})){const name=path.join(folder,entry.name);if(entry.isSymbolicLink())throw new Error('Preview source link denied');if(entry.isDirectory())await collect(name);else files.push(name);}}
 for(const folder of ['src','static','third_party'])await collect(folder);files.sort((a,b)=>a.localeCompare(b,'en-US',{sensitivity:'base'}));
 const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),fingerprint=[];
 for(const name of files)fingerprint.push(`\\${name.replaceAll('/','\\')}:${sha(await fs.readFile(path.join(source,name))).toUpperCase()}`);
 return {commit:git(['rev-parse','HEAD']),build:sha(Buffer.from(fingerprint.join('\n'))),css_sha256:sha(await fs.readFile(path.join(source,'static/styles.css')))};
}
async function atomicJson(file,value,run){const temporary=file+'.'+run+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);}
async function freePort(port){return new Promise(resolve=>{const listener=net.createServer();listener.once('error',()=>resolve(false));listener.listen({host:'127.0.0.1',port,exclusive:true},()=>listener.close(()=>resolve(true)));});}
function previewNetwork(profile){return profile==='backend'?'devdesk-preview-backend-internal':profile==='feature'?'devdesk-preview-feature-internal':'devdesk-preview-internal';}
function sameBind(actual,expected){const normalize=s=>s.replaceAll('\\','/').toLowerCase(),wanted=normalize(expected),observed=normalize(actual);return observed===wanted||observed===wanted.replace(/^([a-z]):\//,'/run/desktop/mnt/host/$1/')||observed===wanted.replace(/^([a-z]):\//,'/host_mnt/$1/');}
function policy(container,relay,root,profile,port){
 const network=previewNetwork(profile),h=container.HostConfig,networks=Object.keys(container.NetworkSettings.Networks||{});
 const common=h.ReadonlyRootfs&&!h.Privileged&&container.Config.User==='10001:10001'&&h.MemorySwap===h.Memory&&h.CapDrop?.includes('ALL')&&h.SecurityOpt?.includes('no-new-privileges');
 if(!common)return false;
 if(relay)return h.PidsLimit===32&&h.Memory===512*1024*1024&&h.NanoCpus===1000000000&&container.Mounts.length===0&&networks.length===2&&networks.includes('bridge')&&networks.includes(network)&&h.PortBindings['8081/tcp']?.length===1&&h.PortBindings['8081/tcp'][0].HostIp==='127.0.0.1'&&h.PortBindings['8081/tcp'][0].HostPort===String(port);
 return h.PidsLimit===128&&h.Memory===1536*1024*1024&&h.NanoCpus===2000000000&&networks.length===1&&networks[0]===network&&Object.keys(h.PortBindings||{}).length===0&&container.Mounts.length===2&&container.Mounts.every(m=>m.Type==='bind'&&((m.Destination==='/input'&&!m.RW&&sameBind(m.Source,path.join(root,'var/fixtures',profile)))||(m.Destination==='/data'&&m.RW&&sameBind(m.Source,path.join(root,'var/data',profile+'-runtime')))));
}
async function healthMatches(identity,port){try{const health=await(await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(2000),redirect:'error'})).json();return health.commit===identity.commit&&health.build===identity.build;}catch{return false;}}
export async function activatePreview(job){
 const profile=job.profile||'frontend';if(!['frontend','backend','feature'].includes(profile))throw Error('Unregistered preview profile');
 const port=profile==='backend'?8082:profile==='feature'?8083:8081,network=previewNetwork(profile),namePrefix=profile==='backend'?'devdesk-preview-backend-':profile==='feature'?'devdesk-preview-feature-':'devdesk-preview-';
 const root=path.resolve(job.root),source=path.join(root,'var/fixtures',profile),identity=await sourceIdentity(root,profile),runner=await load(path.join(root,'var/config/runner.json'));
 const evidenceDirectory=path.join(root,'var/preview-jobs',job.run_id,profile);await fs.mkdir(evidenceDirectory,{recursive:true});
 if(!runner.verified||!/^sha256:[a-f0-9]{64}$/.test(runner.image))throw new Error('Verified preview image required');
 await checkControl(job);
 if(!/^[0-9.]+ linux$/.test(docker(['info','--format','{{.ServerVersion}} {{.OSType}}']).trim()))throw new Error('Preview engine preflight failed');
 const imageId=JSON.parse(docker(['image','inspect',runner.image]))[0].Id;
 const ids=docker(['ps','-a','--filter','label=devdesk.project=1','--format','{{.ID}}']).trim().split('\n').filter(Boolean),owned=[];
 for(const id of ids){const c=JSON.parse(docker(['inspect',id]))[0];if(c.Config.Labels?.['devdesk.workspace']===root&&new RegExp(`^${namePrefix}(relay-)?[a-f0-9]{32}$`).test(c.Name.slice(1)))owned.push(c);}
 const app=owned.find(c=>c.Config.Labels['devdesk.role']==='frontend-preview'),relay=owned.find(c=>c.Config.Labels['devdesk.role']==='frontend-preview-relay');
 const reusable=owned.length===2&&app&&relay&&owned.every(c=>c.State.Running&&Date.now()-Date.parse(c.Created)<600000&&c.Image===imageId&&c.Config.Labels['devdesk.commit']===identity.commit&&c.Config.Labels['devdesk.build']===identity.build)&&policy(app,false,root,profile,port)&&policy(relay,true,root,profile,port)&&await healthMatches(identity,port);
 async function persist(appId,relayId,reused){await checkControl(job);const after=await sourceIdentity(root,profile);if(after.commit!==identity.commit||after.build!==identity.build)throw new Error('Preview source changed during startup');const state={...identity,image:runner.image,container_id:appId,relay_id:relayId,origin:'http://127.0.0.1:'+port,reused};await atomicJson(path.join(source,'build/build-info.json'),{...identity,runtime:'isolated-preview',image:runner.image},job.run_id);await atomicJson(path.join(root,'var/config',profile==='backend'?'preview-backend.json':profile==='feature'?'preview-feature.json':'preview.json'),state,job.run_id);return state;}
 if(reusable)return persist(app.Id,relay.Id,true);
 for(const c of owned){await checkControl(job);docker(['rm','-f',c.Id]);}
 if(!await freePort(port))throw new Error('Port '+port+' is occupied by an unowned service; it was preserved');
 let networkInfo;try{networkInfo=JSON.parse(docker(['network','inspect',network]))[0];}catch(error){if(!/No such network|network .* not found/.test(error.message))throw error;docker(['network','create','--internal','--label','devdesk.role=preview-network',network]);networkInfo=JSON.parse(docker(['network','inspect',network]))[0];}
 if(!networkInfo.Internal||networkInfo.Labels?.['devdesk.role']!=='preview-network'||Object.keys(networkInfo.Containers||{}).length)throw new Error('Preview internal network has an unexpected member');
 const data=path.join(root,'var/data',profile+'-runtime');await fs.mkdir(data,{recursive:true});
 if(!(await fs.stat(path.join(data,'tasks.db')).catch(()=>null))){const original=path.join(root,'var/data',profile+'.db');if(await fs.stat(original).catch(()=>null)){await fs.copyFile(original,path.join(data,'tasks.db'));if(await fs.stat(original+'-wal').catch(()=>null))await fs.copyFile(original+'-wal',path.join(data,'tasks.db-wal'));}}
 const appName=`${namePrefix}${job.run_id}`,relayName=`${namePrefix}relay-${job.run_id}`;if(!/^[a-f0-9]{32}$/.test(job.run_id))throw new Error('Preview identity denied');
 const created=[];
 function common(name,role,memory,cpu,pids){return ['create','--name',name,'--label',`devdesk.role=${role}`,'--label','devdesk.project=1','--label',`devdesk.workspace=${root}`,'--label',`devdesk.commit=${identity.commit}`,'--label',`devdesk.build=${identity.build}`,'--read-only','--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges','--memory',memory,'--memory-swap',memory,'--cpus',cpu,'--pids-limit',pids];}
 try{
  await checkControl(job);
  docker([...common(appName,'frontend-preview','1536m','2','128'),'--network',network,'--network-alias','devdesk-preview-app','--env','DEVDESK_PROFILE='+profile,'--env',`DEVDESK_BASE_COMMIT=${identity.commit}`,'--env',`DEVDESK_CSS_SHA256=${identity.css_sha256}`,'--tmpfs','/tmp:rw,exec,nosuid,nodev,size=768m,mode=1777','--mount',`type=bind,source=${source},target=/input,readonly`,'--mount',`type=bind,source=${data},target=/data`,'--entrypoint','timeout',runner.image,'--signal=KILL','1800s','node','/opt/runner/preview.mjs']);created.push(appName);
  await checkControl(job);
  docker([...common(relayName,'frontend-preview-relay','512m','1','32'),'--network','bridge','--publish','127.0.0.1:'+port+':8081','--entrypoint','timeout',runner.image,'--signal=KILL','1800s','node','/opt/runner/preview-relay.mjs']);created.push(relayName);docker(['network','connect',network,relayName]);
  const observedApp=JSON.parse(docker(['inspect',appName]))[0],observedRelay=JSON.parse(docker(['inspect',relayName]))[0];if(!policy(observedApp,false,root,profile,port)||!policy(observedRelay,true,root,profile,port))throw new Error('Preview container policy mismatch');
  docker(['start',appName]);docker(['start',relayName]);let healthy=false;
  const started=Date.now();while(Date.now()-started<100000){await checkControl(job);if(await healthMatches(identity,port)){healthy=true;break;}if(created.some(name=>!JSON.parse(docker(['inspect',name]))[0].State.Running))throw new Error('Preview stopped before readiness');await new Promise(r=>setTimeout(r,500));}
  const readiness=JSON.parse(docker(['exec',appName,'cat','/tmp/evidence/preview-ready.json']));if(!healthy||readiness.external_network_denied!==true||readiness.identity.base_commit!==identity.commit||readiness.identity.source_sha256!==identity.build)throw new Error('Preview readiness or isolation did not pass');
  await fs.writeFile(path.join(evidenceDirectory,'runtime-evidence.json'),JSON.stringify({app:observedApp.Id,relay:observedRelay.Id,readiness,app_network:'internal',relay_mounts:[],published_host:'127.0.0.1',healthy:true},null,2));
  return await persist(observedApp.Id,observedRelay.Id,false);
 }catch(error){const diagnostics={reason:error.message};for(const name of created){try{diagnostics[name]=docker(['logs','--tail','20',name]);}catch{}}await fs.writeFile(path.join(evidenceDirectory,'diagnostics.json'),JSON.stringify(diagnostics,null,2));for(const name of created.reverse()){try{docker(['rm','-f',name]);}catch{}}throw error;}
}
