// Isolated preview: only task source and necessary synthetic data are mounted.
import fs from 'node:fs/promises';import http from 'node:http';import net from 'node:net';import {spawn,execFileSync} from 'node:child_process';import {buildTask} from './runtime-build.mjs';
const identity=await buildTask();
const denied=await new Promise(resolve=>{const socket=net.connect({host:'1.1.1.1',port:80});socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve(false);});socket.once('error',()=>{socket.destroy();resolve(true);});socket.once('timeout',()=>{socket.destroy();resolve(true);});});
if(!denied)throw new Error('Preview network isolation failed');
if(!(await fs.stat('/data/tasks.db').catch(()=>null)))execFileSync('/tmp/team-tasks',['--db','/data/tasks.db','--seed'],{timeout:5000});
const profile=process.env.DEVDESK_PROFILE||'frontend';
const scenario=profile==='feature'&&(await fs.readFile('/tmp/task/static/index.html','utf8')).includes('data-filter="done"')?'accepted-feature':profile;
const app=spawn('/tmp/team-tasks',['--db','/data/tasks.db','--static','/tmp/task/static','--port','8080','--scenario',scenario],{stdio:'ignore'});app.once('exit',()=>process.exit(1));
let ready=false;for(let i=0;i<60;i++){try{const health=await(await fetch('http://127.0.0.1:8080/api/health')).json();if(health.commit===identity.base_commit&&health.build===identity.source_sha256){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
if(!ready)throw new Error('Preview app did not start with expected identity');
const proxy=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8081');
  if(url.origin!=='http://127.0.0.1:8081'||!['GET','POST','PATCH','DELETE'].includes(req.method)||!(['/','/index.html','/app.js','/styles.css','/api/tasks','/api/health'].includes(url.pathname)||/^\/api\/tasks\/\d+$/.test(url.pathname))){res.writeHead(404);res.end();return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>16000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  // Workbench cookies, authorization and user-selected hosts are not forwarded.
  const headers={Origin:'http://127.0.0.1:8080',Connection:'close'};if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];
  const upstream=http.request({host:'127.0.0.1',port:8080,path:url.pathname+url.search,method:req.method,headers,timeout:5000},response=>{res.writeHead(response.statusCode,{'Content-Type':response.headers['content-type']||'application/octet-stream','Cache-Control':'no-store'});response.pipe(res);});
  upstream.once('timeout',()=>upstream.destroy());upstream.once('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});upstream.end(Buffer.concat(chunks));
 }catch{if(!res.headersSent)res.writeHead(400);res.end();}
});
await new Promise(resolve=>proxy.listen(8081,'0.0.0.0',resolve));await fs.mkdir('/tmp/evidence',{recursive:true});await fs.writeFile('/tmp/evidence/preview-ready.json',JSON.stringify({identity,external_network_denied:true}));
