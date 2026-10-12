// Protected helper capability. None of these fields are model-selected.
import fs from 'node:fs/promises';import path from 'node:path';
export async function checkControl(job,{cancel=true}={}){
 if(!job.lease_token)return; // fixed, direct developer fixtures; worker always binds a lease
 if(!/^[a-f0-9]{32}$/.test(job.lease_token)||!Number.isSafeInteger(job.lease_fence)||job.lease_fence<1||!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(job.owner_schema))throw new Error('Invalid worker capability');
 const root=path.resolve(job.root||job.workspace_root),cap=JSON.parse(await fs.readFile(path.join(root,'var/leases/project-1.json'),'utf8'));
 if(cap.token!==job.lease_token||cap.fence!==job.lease_fence||cap.owner_schema!==job.owner_schema||cap.expires_ms<=Date.now())throw new Error('Worker fenced before tool execution');
 if(cancel&&job.ticket_id){if(!/^[0-9]{1,20}$/.test(String(job.ticket_id)))throw new Error('Invalid ticket identity');
  const marker=await fs.readFile(path.join(root,'var/control',job.owner_schema,`${job.ticket_id}.cancel.json`),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(marker&&JSON.parse(marker).cancel_requested)throw new Error('Requester cancelled tool execution');
 }
}
