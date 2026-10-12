// Protected registry: model text cannot choose source roots, evaluators or ports.
export function repairProfile(name='frontend'){
 if(name==='frontend')return {name,file:'static/styles.css',port:8081,checks:[]};
 if(name==='feature')return {name,file:'static/index.html',port:8083,checks:['completed_filter_390','completed_filter_1280']};
 if(name==='backend')return {name,file:'src/task_repository.cpp',port:8082,checks:['evaluator_user_separated','seed_matches_database','filter_matches_database','filter_after_mutations','invalid_filter_rejected','database_preserved_by_reads']};
 throw new Error('Unregistered repair profile');
}
export const commonChecks=['build','app_source_identity','seeded_tasks','filter_todo','filter_in_progress','filter_done','action_buttons_separate_390','no_horizontal_overflow_390','no_script_errors_390','browser_create_390','browser_advance_390','browser_remove_390','action_buttons_separate_1280','no_horizontal_overflow_1280','no_script_errors_1280','browser_create_1280','browser_advance_1280','browser_remove_1280','create_task','advance_task'];
export function assertBackendScope(before,after){
 before=before.replaceAll('\r\n','\n');after=after.replaceAll('\r\n','\n');
 const start='std::vector<Task> TaskRepository::list_tasks(const std::string& status) {',end='Task TaskRepository::get_task(long long id) {';
 function parts(text){const first=text.indexOf(start);if(first<0||text.indexOf(start,first+1)>=0||!text.includes(end))throw Error('Backend function boundary changed');let depth=1,state='code';for(let i=first+start.length;i<text.length;i++){const c=text[i],next=text[i+1];if(state==='line'){if(c==='\n')state='code';continue;}if(state==='comment'){if(c==='*'&&next==='/'){state='code';i++;}continue;}if(state==='"'||state==="'"){if(c==='\\'){i++;continue;}if(c===state)state='code';continue;}if(c==='/'&&next==='/'){state='line';i++;continue;}if(c==='/'&&next==='*'){state='comment';i++;continue;}if(c==='"'||c==="'"){state=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return {prefix:text.slice(0,first+start.length),suffix:text.slice(i)};}throw Error('Backend function braces changed');}
 const a=parts(before),b=parts(after);if(a.prefix!==b.prefix||a.suffix!==b.suffix)throw Error('Edit exceeds approved list_tasks function');
}
export function assertProfileScope(profile,before,after){
 if(profile==='backend')return assertBackendScope(before,after);
 if(profile!=='feature')return;
 function parts(text){text=text.replace(/\r+\n/g,'\n');const marker='<nav class="filters" aria-label="Filter tasks">',start=text.indexOf(marker),end=text.indexOf('</nav>',start);if(start<0||end<0||text.indexOf(marker,start+1)>=0)throw Error('Feature filter navigation boundary changed');return {prefix:text.slice(0,start+marker.length),body:text.slice(start+marker.length,end),suffix:text.slice(end)};}
 const a=parts(before),b=parts(after);if(a.prefix!==b.prefix||a.suffix!==b.suffix)throw Error('Feature edit exceeds filter navigation');
 const buttons=[...b.body.matchAll(/<button\s+([^<>]+)>([^<>]+)<\/button>/g)];
 if(buttons.length<3||buttons.length>4||b.body.replace(/<button\s+([^<>]+)>([^<>]+)<\/button>/g,'').trim())throw Error('Only plain filter buttons are allowed');
 const statuses=new Set();
 for(const button of buttons){const attributes=[...button[1].matchAll(/([a-z-]+)="([^"]*)"/g)],values=Object.fromEntries(attributes.map(a=>[a[1],a[2]]));if(attributes.length!==3||Object.keys(values).length!==3||button[1].replace(/[a-z-]+="[^"]*"/g,'').trim()||values.type!=='button'||!['','todo','in_progress','done'].includes(values['data-filter'])||!['true','false'].includes(values['aria-pressed'])||statuses.has(values['data-filter']))throw Error('Filter button attributes exceed feature scope');statuses.add(values['data-filter']);}
 if(!['','todo','in_progress'].every(s=>statuses.has(s)))throw Error('Existing filters must remain');
 const original=[...a.body.matchAll(/<button\s+([^<>]+)>([^<>]+)<\/button>/g)];
 for(const button of original){const status=button[1].match(/data-filter="([^"]*)"/)?.[1];const current=buttons.find(b=>b[1].match(/data-filter="([^"]*)"/)?.[1]===status);if(!current||current[1]!==button[1]||current[2]!==button[2])throw Error('Existing filter markup must remain unchanged');}
 const completed=buttons.find(b=>b[1].includes('data-filter="done"'));if(completed&&(completed[2].trim()!=='Completed'||!completed[1].includes('aria-pressed="false"')))throw Error('New Completed filter must retain its reviewed label and inactive initial state');
}
