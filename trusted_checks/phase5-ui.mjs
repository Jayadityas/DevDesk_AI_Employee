// Read-only Chrome check of actual completed history; no acceptance or integration.
import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),load=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,'')),{chromium}=createRequire(path.join(root,'tools/package.json'))('playwright');
const release=(await load(path.join(root,'devdesk/build/latest.json'))).directory;
const origin=path.join(root,'var/evidence/phase5-2026-10-12T02-44-21.225Z-28452/accepted');
const directory=path.join(root,'var/evidence',`phase5-ui-${new Date().toISOString().replaceAll(':','-')}-${process.pid}`);await fs.mkdir(directory,{recursive:true});
let server,browser;const checks=[],check=(name,good)=>checks.push({name,result:good?'PASS':'FAIL'});
try{
 const free=await new Promise(resolve=>{const p=net.createServer();p.once('error',()=>resolve(false));p.listen({host:'127.0.0.1',port:8102,exclusive:true},()=>p.close(()=>resolve(true)));});if(!free)throw new Error('Port 8102 occupied; existing service preserved');
 server=spawn(path.join(release,'devdesk.exe'),['--serve',path.join(origin,'test-config.json'),'8102',path.join(release,'static')],{windowsHide:true,stdio:'ignore'});
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:8102')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8102');const account=(await load(path.join(origin,'accounts.json'))).find(a=>a.username==='asha');await page.locator('[name=username]').fill('asha');await page.locator('[name=password]').fill(account.password);await page.locator('#login-form button').click();await page.locator('#workspace').waitFor();
 await page.locator('[data-view=history]').click();await page.locator('.record').first().waitFor();check('completed_ticket_rendered_in_history',(await page.locator('#records').innerText()).includes('COMPLETED'));
 await page.getByRole('button',{name:'View report',exact:true}).first().click();await page.locator('#detail').waitFor();const text=await page.locator('#detail').innerText();
 check('exact_candidate_and_integration_evidence_visible',text.includes('4945512e8e8d07ca6901a1581bc1363d2cbc7254')&&text.includes('Integration')&&text.includes('FINISHED'));
 await page.waitForFunction(()=>[...document.querySelectorAll('#detail img')].length===2&&[...document.querySelectorAll('#detail img')].every(i=>i.complete&&i.naturalWidth>0));check('candidate_images_load_for_requester',true);
 check('completed_ticket_has_no_acceptance_buttons',await page.getByRole('button',{name:'Accept candidate and authorize integration',exact:true}).count()===0);
 check('no_frontend_script_errors',errors.length===0);await page.screenshot({path:path.join(directory,'completed-history.png')});
}catch(error){checks.push({name:'ui_suite',result:'FAIL',detail:error.message.slice(0,300)});}
finally{if(browser)await browser.close();if(server?.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}}
const fail=checks.filter(c=>c.result==='FAIL').length;process.exitCode=fail?1:0;await fs.writeFile(path.join(directory,'report.json'),JSON.stringify({phase:5,mode:'actual_completed_history_ui',checks},null,2));console.log(JSON.stringify({directory:path.relative(root,directory),pass:checks.length-fail,fail}));
