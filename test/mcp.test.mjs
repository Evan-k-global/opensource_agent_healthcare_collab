import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP exposes only two scoped tools and forwards authorization and stale-step failures', async () => {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ url: req.url, authorization: req.headers.authorization, body });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/status') res.end(JSON.stringify({ step: 4, canAct: true }));
    else { res.writeHead(409); res.end(JSON.stringify({ error: 'wrong_agent_or_stale_turn' })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = mkdtempSync(join(tmpdir(), 'research-mcp-'));
  const tokenFile = join(dir, 'access.json');
  writeFileSync(tokenFile, JSON.stringify({ agentId: 'a-liaison', token: 'fixture-scoped-secret', baseUrl: `http://127.0.0.1:${server.address().port}` }), { mode: 0o600 });
  const client = new Client({ name: 'integration-test', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('src/mcp.mjs')], env: { AGENT_TOKEN_FILE: tokenFile } }));
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(t => t.name).sort(), ['research_status', 'research_take_turn']);
    const status = await client.callTool({ name: 'research_status', arguments: {} });
    assert.equal(JSON.parse(status.content[0].text).step, 4);
    const stale = await client.callTool({ name: 'research_take_turn', arguments: { expectedStep: 3 } });
    assert.equal(stale.isError, true);
    assert.match(stale.content[0].text, /wrong_agent_or_stale_turn/);
    assert.equal(calls[1].body, '{"expectedStep":3}');
    assert.ok(calls.every(c => c.authorization === 'Bearer fixture-scoped-secret'));
    assert.ok(!JSON.stringify([listed, status, stale]).includes('fixture-scoped-secret'));
  } finally {
    await client.close(); await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true });
  }
});

test('accepted long-running turns poll status without resubmitting and fail on case replacement',async()=>{
  let posts=0,gets=0,replace=false;
  const server=http.createServer(async(req,res)=>{
    for await(const _ of req){}
    res.setHeader('content-type','application/json');
    if(req.url==='/turn'){posts++;res.writeHead(202);res.end(JSON.stringify({accepted:true,caseId:'original',expectedStep:4}));}
    else {gets++;res.end(JSON.stringify({caseId:replace?'replacement':'original',state:'computing',step:gets<3?4:5,busy:gets<3}));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const dir=mkdtempSync(join(tmpdir(),'research-poll-')),tokenFile=join(dir,'access.json');
  writeFileSync(tokenFile,JSON.stringify({agentId:'a-liaison',token:'test-token',baseUrl:`http://127.0.0.1:${server.address().port}`}));
  const client=new Client({name:'poll-test',version:'1'});
  try{
    await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve('src/mcp.mjs')],env:{AGENT_TOKEN_FILE:tokenFile}}));
    const result=await client.callTool({name:'research_take_turn',arguments:{expectedStep:4}});
    assert.equal(result.isError,undefined);assert.equal(JSON.parse(result.content[0].text).step,5);assert.equal(posts,1);assert.equal(gets,3);
    replace=true;const changed=await client.callTool({name:'research_take_turn',arguments:{expectedStep:4}});assert.equal(changed.isError,true);assert.match(changed.content[0].text,/turn_case_changed/);assert.equal(posts,2);
  }finally{await client.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true});}
});
