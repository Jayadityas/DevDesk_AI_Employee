// Trusted ingress relay; no editable source, data or credentials are mounted.
import http from 'node:http';
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8081');
  if(url.origin!=='http://127.0.0.1:8081'||!['GET','POST','PATCH','DELETE'].includes(req.method)||!(['/','/index.html','/app.js','/styles.css','/api/tasks','/api/health'].includes(url.pathname)||/^\/api\/tasks\/\d+$/.test(url.pathname))){res.writeHead(404);res.end();return;}
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const headers={Connection:'close'};if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];
  const upstream=http.request({host:'devdesk-preview-app',port:8081,path:url.pathname+url.search,method:req.method,headers,timeout:5000},response=>{res.writeHead(response.statusCode,{'Content-Type':response.headers['content-type']||'application/octet-stream','Cache-Control':'no-store'});response.pipe(res);});
  upstream.once('timeout',()=>upstream.destroy());upstream.once('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});upstream.end(Buffer.concat(chunks));
 }catch{if(!res.headersSent)res.writeHead(400);res.end();}
});
server.listen(8081,'0.0.0.0');
