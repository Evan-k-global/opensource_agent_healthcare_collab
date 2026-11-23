import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { advise } from '../src/intelligence.mjs';
import { sshWorkerArgs } from '../src/remote-worker.mjs';
test('model suggestions stay local, advisory, role-bound and fail closed', async () => {
  const previous = { ...process.env }; let output = { decision: 'proceed', role: 'researcher', rationale: 'Review the fixed computation.' }; let observed;
  const server = http.createServer(async (req,res) => { let s='';for await (const c of req) s+=c;observed=JSON.parse(s);res.setHeader('content-type','application/json');res.end(JSON.stringify({ choices:[{message:{content:JSON.stringify(output)}}] })); });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  try {
    process.env.AGENT_INTELLIGENCE='mock';process.env.GEMMA_A_BASE_URL=`http://127.0.0.1:${server.address().port}/v1`;
    const result = await advise({ org:'a',role:'researcher',action:'compute-a' }); assert(result.advisoryOnly);
    const request = JSON.parse(observed.messages[1].content); assert.deepEqual(Object.keys(request).sort(), ['action','advisoryOnly','algorithm','disclosure','humanReview','org','role']);
    output.role='administrator';await assert.rejects(() => advise({org:'a',role:'researcher',action:'compute-a'}),/exceeds_policy/);
    output={decision:'hold',role:'researcher',rationale:'Needs review'};assert.equal((await advise({org:'a',role:'researcher',action:'compute-a'})).decision,'hold');
    process.env.GEMMA_A_BASE_URL='https://example.com/v1';await assert.rejects(() => advise({org:'a',role:'researcher',action:'compute-a'}),/local_model/);
  } finally { for(const k of ['AGENT_INTELLIGENCE','GEMMA_A_BASE_URL']) { if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]; } await new Promise(r=>server.close(r)); }
});
test('SSH workers require pinned host trust, safe arguments and a company-local model', () => {
  const args=sshWorkerArgs('a',{host:'company-a',directory:"/srv/research team's demo",intelligence:'gemma',model:'gemma-local'});
  assert(args.includes('StrictHostKeyChecking=yes'));assert(args.includes('BatchMode=yes'));assert(args.at(-1).includes("'\\''"));
  assert.throws(()=>sshWorkerArgs('a',{host:'-oProxyCommand=evil',directory:'/srv/demo'}),/invalid/);
  assert.throws(()=>sshWorkerArgs('a',{host:'company-a',directory:'/srv/demo',modelBaseUrl:'https://cloud.example/v1'}),/company_local/);
});
