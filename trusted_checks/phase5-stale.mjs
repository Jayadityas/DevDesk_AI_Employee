// Fresh negative fixture derived from the real completed candidate. The accepted
// base is now obsolete: integration must block without touching shared source.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const directory=path.join(root,'var/evidence',`phase5-stale-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`);await fs.mkdir(directory,{recursive:true});
const origin=await load(path.join(root,'var/evidence/phase5-2026-10-12T02-44-21.225Z-28452/accepted/test-config.json'));
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory,exe=path.join(release,'devdesk.exe'),secrets=await load(path.join(root,'var/config/postgres-admin.json'));let config;const checks=[];
function command(file,args,options={}){const r=spawnSync(file,args,{encoding:'utf8',windowsHide:true,cwd:root,...options});if(r.status!==0)throw new Error('Trusted setup/read failed; sensitive details withheld');return r.stdout.trim();}
function sql(query){return command('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5433','-U','devdesk_admin','-d','devdesk_demo'],{input:`SET search_path TO ${config.schema};${query}`,env:{...process.env,PGPASSWORD:secrets.admin}});}
const fixture=path.join(root,'var/fixtures/frontend');const head=()=>command('git',['-c',`safe.directory=${fixture}`,'-C',fixture,'rev-parse','HEAD']);const before=head();
try{
 command('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','tools/Setup-Phase2Test.ps1','-RunDirectory',directory]);config=await load(path.join(directory,'test-config.json'));command(exe,['--seed',path.join(directory,'test-config.json'),path.join(directory,'accounts.json')]);
 if(!/^test_[a-f0-9]{32}$/.test(origin.schema))throw new Error('Fresh source schema required');
 let copy=`SET ROLE devdesk_owner;INSERT INTO requests SELECT (jsonb_populate_record(NULL::requests,to_jsonb(r)||'{"upload_id":null}'::jsonb)).* FROM ${origin.schema}.requests r;`;
 for(const table of ['investigations','tickets','investigation_runs','scope_proposals','scope_approvals','repair_runs','repair_steps','candidate_reviews','candidate_decisions'])copy+=`INSERT INTO ${table} SELECT * FROM ${origin.schema}.${table};`;
 // Renew time only in this explicit negative fixture; keep the accepted hash,
 // candidate, evidence and stale base identical to the real completed record.
 copy+="UPDATE tickets SET state='ACCEPTED';UPDATE candidate_reviews SET expires_at=now()+interval '30 minutes';";sql(copy);
 const worker=spawnSync(exe,['--integrate',path.join(directory,'test-config.json'),root],{encoding:'utf8',windowsHide:true,cwd:root,timeout:200000});
 const record=JSON.parse(sql("SELECT json_build_object('ticket',(SELECT state FROM tickets LIMIT 1),'run',(SELECT row_to_json(r) FROM integration_runs r LIMIT 1));"));
 checks.push({name:'stale_base_blocks_integration',result:worker.status!==0&&record.ticket==='INTEGRATION_BLOCKED'&&record.run.state==='BLOCKED'?'PASS':'FAIL'});
 checks.push({name:'shared_source_and_history_preserved',result:head()===before&&command('git',['-c',`safe.directory=${fixture}`,'-C',fixture,'status','--porcelain'])===''?'PASS':'FAIL'});
 checks.push({name:'blocked_candidate_never_completed',result:sql("SELECT count(*) FROM tickets WHERE state='COMPLETED';")==='0'?'PASS':'FAIL'});
 checks.push({name:'no_automatic_replay',result:command(exe,['--integrate',path.join(directory,'test-config.json'),root]).includes('No eligible')&&sql('SELECT count(*) FROM integration_runs;')==='1'?'PASS':'FAIL'});
 await fs.writeFile(path.join(directory,'redacted-trace.json'),JSON.stringify(record,null,2));
}catch(error){checks.push({name:'stale_suite',result:'FAIL',detail:error.message});}
const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:5,mode:'scripted_negative_fixture',checks},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));
