import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
const root=new URL('../',import.meta.url);
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function wait(fn){for(let i=0;i<160;i++){try{const value=await fn();if(value)return value;}catch{}await delay(50);}throw new Error('test_startup_timeout');}
test('dashboard authorization and interactive reviews enforce company boundaries end to end',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'research-admin-')),children=[];const apiPort=await port(),uiPort=await port();
 cpSync(new URL('../fixtures',import.meta.url),join(dir,'fixtures'),{recursive:true});
 const launch=(script,env)=>{const c=spawn(process.execPath,[new URL(script,root).pathname],{cwd:dir,env:{...process.env,COMPANY_REMOTE_CONFIG:'',WORKER_ISOLATION:'',IDENTITY_PROVIDER_CONFIG:'',AGENT_INTELLIGENCE:'off',...env},stdio:['ignore','ignore','pipe']});let errors='';c.stderr.on('data',x=>errors+=x);children.push(c);return c;};
 try{
  launch('src/server.mjs',{PORT:String(apiPort),HUMAN_REVIEW:'1',MODEL_ROUTING:'0'});
  await wait(()=>existsSync(join(dir,'.local/company-b/b-reviewer.access.json')));
  const access=name=>JSON.parse(readFileSync(join(dir,'.local',name)));
  const a=access('company-a/admin.access.json'),b=access('company-b/admin.access.json'),operator=access('admin.access.json');
  const call=async(path,credential,body)=>{const r=await fetch(`http://127.0.0.1:${apiPort}${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${credential.token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(r.status===202){for(let i=0;i<160;i++){const status=await call('/status',credential);if(status.data.step>body.expectedStep||status.data.state==='failed')return status;await delay(50);}throw new Error('turn_timeout');}return{status:r.status,data};};
  assert.equal((await call('/turn',a,{expectedStep:0})).status,403);
  const ids=['a-researcher','a-reviewer','b-researcher','b-reviewer','a-liaison','b-liaison'];
  for(let step=0;step<5;step++){const id=ids[step];assert.equal((await call('/turn',access(`company-${id[0]}/${id}.access.json`),{expectedStep:step})).status,200);}
  const turn=call('/turn',access('company-b/b-liaison.access.json'),{expectedStep:5});
  const first=await wait(async()=>{const view=(await call('/admin/status',a)).data;return view.controls.requests.find(r=>r.state==='pending');});
  assert.equal((await call('/admin/review',operator,{caseId:a.caseId,id:first.id,decision:'approve'})).status,409);
  assert.equal((await call('/admin/review',b,{caseId:a.caseId,id:first.id,decision:'approve'})).status,409);
  await call('/admin/review',a,{caseId:a.caseId,id:first.id,decision:'hold'});assert.equal((await call('/admin/status',a)).data.status.step,5);
  await call('/admin/review',a,{caseId:a.caseId,id:first.id,decision:'approve'});
  const second=await wait(async()=>{const view=(await call('/admin/status',b)).data;return view.controls.requests.find(r=>r.state==='pending');});
  await call('/admin/review',b,{caseId:b.caseId,id:second.id,decision:'approve'});assert.equal((await turn).data.step,6);
  launch('src/admin-server.mjs',{ADMIN_PORT:String(uiPort),ADMIN_ACCESS_FILE:join(dir,'.local/company-a/admin.access.json')});
  await wait(()=>fetch(`http://127.0.0.1:${uiPort}/`).then(r=>r.ok));
  let r=await fetch(`http://127.0.0.1:${uiPort}/api/view`,{headers:{authorization:`Bearer ${b.token}`}});assert.equal(r.status,401);
  r=await fetch(`http://127.0.0.1:${uiPort}/api/view`,{headers:{authorization:`Bearer ${a.token}`,origin:'https://attacker.invalid'}});assert.equal(r.status,409);
  r=await fetch(`http://127.0.0.1:${uiPort}/api/view`,{headers:{authorization:`Bearer ${a.token}`}});const view=await r.json();assert.equal(r.status,200);assert.equal(view.privateReport.company,'a');assert.deepEqual(Object.keys(view.privateReport.rooms).sort(),['a-internal','bilateral-planning']);assert(!JSON.stringify(view).includes('b-internal'));
  assert.equal((await call('/admin/status',operator)).data.privateReport,undefined);
 }finally{for(const child of children.reverse()){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
});
