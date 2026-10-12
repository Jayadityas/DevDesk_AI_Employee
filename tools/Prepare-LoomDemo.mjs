// Presentation copy of real verified completions; no replay/inference/shared source edits.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,'')),release=(await load(path.join(root,'devdesk/build/latest.json'))).directory;
const directory=path.join(root,'var/evidence','loom-demo-'+Date.now());await fs.mkdir(directory,{recursive:true});
function command(file,args,options={}){const r=spawnSync(file,args,{cwd:root,encoding:'utf8',windowsHide:true,...options});if(r.status!==0)throw Error('Demo preparation command failed; sensitive output withheld');return r.stdout.trim();}
command('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Setup-Phase2Test.ps1','-RunDirectory',directory]);
const config=await load(path.join(directory,'test-config.json')),secrets=await load(path.join(root,'var/config/postgres-admin.json'));command(path.join(release,'devdesk.exe'),['--seed',path.join(directory,'test-config.json'),path.join(directory,'accounts.json')]);
function sql(text){return command('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5433','-U','devdesk_admin','-d','devdesk_demo'],{input:`SET search_path TO ${config.schema};\n${text}`,env:{...process.env,PGPASSWORD:secrets.admin}});}
const cases=[['frontend','var/evidence/phase5-2026-10-12T02-44-21.225Z-28452/accepted/test-config.json','5ccec08da5757a15976c94164dc94ebe',20],['backend','var/evidence/phase7-live-2026-10-12T13-12-50.704Z-13644/test-config.json','07cea189ea2bbc8d797d143237f2d6ac',26],['feature','var/evidence/phase8-live-2026-10-12T14-24-51.126Z-8204/test-config.json','b04da9bc612b12f3e14de3d216624286',22]];
const provenance=[];await fs.mkdir(config.uploads,{recursive:true});
for(let i=0;i<cases.length;i++){
 const [profile,file,integration,count]=cases[i],source=await load(path.join(root,file));if(!/^test_[a-f0-9]{32}$/.test(source.schema))throw Error('Original demonstration must be a test schema');const schema=source.schema,offset=(i+1)*1000;
 const origin=JSON.parse(sql(`SELECT row_to_json(x) FROM (SELECT t.id,t.request_id,t.investigation_id,ir.state AS integration_state,ir.result,t.state FROM ${schema}.tickets t JOIN ${schema}.integration_runs ir ON ir.ticket_id=t.id WHERE ir.id='${integration}') x;`));
 const result=typeof origin.result==='string'?JSON.parse(origin.result):origin.result;if(origin.state!=='COMPLETED'||origin.integration_state!=='FINISHED'||result.checks.report.checks.length!==count||!result.checks.report.checks.every(c=>c.result==='PASS'))throw Error('Original completion lacks verified integrated evidence');
 const ticket=Number(origin.id),request=Number(origin.request_id),investigation=Number(origin.investigation_id),runs=`SELECT id FROM ${schema}.investigation_runs WHERE ticket_id=${ticket}`,proposals=`SELECT id FROM ${schema}.scope_proposals WHERE ticket_id=${ticket}`,repairs=`SELECT id FROM ${schema}.repair_runs WHERE ticket_id=${ticket}`,reviews=`SELECT id FROM ${schema}.candidate_reviews WHERE repair_id IN(${repairs})`;
 const uploadFilter=`id IN(SELECT upload_id FROM ${schema}.requests WHERE id=${request} UNION SELECT upload_id FROM ${schema}.observations WHERE run_id IN(${runs}))`;
 const filters={uploads:uploadFilter,requests:`id=${request}`,investigations:`id=${investigation}`,tickets:`id=${ticket}`,investigation_runs:`ticket_id=${ticket}`,observations:`run_id IN(${runs})`,decisions:`run_id IN(${runs})`,scope_proposals:`ticket_id=${ticket}`,scope_approvals:`proposal_id IN(${proposals})`,repair_runs:`ticket_id=${ticket}`,repair_steps:`run_id IN(${repairs})`,candidate_reviews:`repair_id IN(${repairs})`,candidate_decisions:`review_id IN(${reviews})`,integration_runs:`ticket_id=${ticket}`,events:`ticket_id=${ticket}`,notifications:`ticket_id=${ticket}`};
 if(profile==='feature'){filters.feature_polls=`ticket_id=${ticket}`;filters.feature_poll_members=`poll_id IN(SELECT id FROM ${schema}.feature_polls WHERE ticket_id=${ticket})`;filters.feature_votes=filters.feature_poll_members;}
 let copy='BEGIN; SET LOCAL ROLE devdesk_owner;';
 for(const [table,filter]of Object.entries(filters)){
  const override={};if(['requests','investigations','tickets','decisions','repair_steps','events','notifications'].includes(table))override.id=`r.id+${offset}`;
  if(['tickets','investigations'].includes(table))override.request_id=`r.request_id+${offset}`;
  if(table==='tickets'){override.investigation_id=`r.investigation_id+${offset}`;override.cancel_requested='false';}
  if(['investigation_runs','scope_proposals','repair_runs','integration_runs','events','notifications','feature_polls'].includes(table))override.ticket_id=`r.ticket_id+${offset}`;
  if(['scope_proposals','repair_runs','integration_runs'].includes(table))override.profile=`'${profile}'`;
  if(['investigation_runs','repair_runs','integration_runs'].includes(table)){override.lease_token="''";override.lease_fence='0';}
  if(table==='repair_runs')override.scope_hash=`(SELECT scope_hash FROM ${schema}.scope_proposals WHERE id=r.proposal_id)`;
  if(table==='notifications')override.operation_key=`'presentation-${profile}:'||r.operation_key`;
  const fields=Object.entries(override).flatMap(([key,value])=>[`'${key}'`,value]).join(',');copy+=`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(r)${fields?'||jsonb_build_object('+fields+')':''})).* FROM ${schema}.${table} r WHERE ${filter};`;
 }
 copy+=`INSERT INTO events(ticket_id,actor_kind,type,message) VALUES(${ticket+offset},'worker','presentation_provenance','Presentation copy of a real verified ${profile} completion. IDs remapped for viewing; model inference was not replayed.');COMMIT;`;sql(copy);
 const uploads=JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]'::json) FROM(SELECT filename FROM ${schema}.uploads WHERE ${uploadFilter}) x;`));
 for(const u of uploads){if(!/^[a-f0-9]{32}\.(png|jpg|jpeg)$/.test(u.filename))throw Error('Unexpected evidence filename');const src=path.resolve(source.uploads,u.filename);if(!src.toLowerCase().startsWith(path.join(root,'var').toLowerCase()+path.sep))throw Error('Evidence must remain inside workspace var');await fs.copyFile(src,path.join(config.uploads,u.filename));}
 provenance.push({profile,original_ticket:ticket,presentation_ticket:ticket+offset,integration,assertions:count,original_schema:schema});
}
for(const table of ['requests','investigations','tickets','decisions','repair_steps','events','notifications'])sql(`SELECT setval(pg_get_serial_sequence('${table}','id'),greatest(coalesce((SELECT max(id) FROM ${table}),0),1),EXISTS(SELECT 1 FROM ${table}));`);
await fs.writeFile(path.join(directory,'provenance.json'),JSON.stringify(provenance,null,2));await fs.writeFile(path.join(root,'var/evidence/loom-demo-latest.json'),JSON.stringify({directory,config:path.join(directory,'test-config.json'),accounts:path.join(directory,'accounts.json'),release},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),completed_records:3,new_model_calls:0}));
