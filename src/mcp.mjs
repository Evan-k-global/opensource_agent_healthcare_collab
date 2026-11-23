import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

if (!process.env.AGENT_TOKEN_FILE) throw new Error('Set AGENT_TOKEN_FILE to this agent’s scoped access file.');
const access = JSON.parse(readFileSync(process.env.AGENT_TOKEN_FILE, 'utf8'));
const url = new URL(access.baseUrl);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('local_demo_endpoint_required');
async function call(path, body) {
  const deadline = Date.now() + 60 * 60 * 1000;
  const send = (path, body) => fetch(new URL(path, url), {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${access.token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Submit exactly once. Only GET status is retried during long proof/review work.
  let response = await send(path, body), result = await response.json();
  const accepted = response.status === 202 && result.accepted === true;
  const caseId = result.caseId;
  while (accepted && response.ok && result.state !== 'failed' && !(Number.isInteger(result.step) && result.step > body.expectedStep)) {
    if (Date.now() >= deadline) throw new Error('turn_status_deadline_exceeded');
    await new Promise(resolve => setTimeout(resolve, 500));
    try { response = await send('/status'); } catch { continue; }
    result = await response.json();
    if (result.caseId && result.caseId !== caseId) throw new Error('turn_case_changed');
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }], ...(!response.ok || result.state === 'failed' ? { isError: true } : {}) };
}
const server = new McpServer({ name: `research-${access.agentId}`, version: '0.1.0' });
server.registerTool('research_status', {
  description: 'Read the synthetic collaboration state and this agent’s next authorized action. No raw research or patient data is returned.', inputSchema: {},
}, async () => call('/status'));
server.registerTool('research_take_turn', {
  description: 'Perform exactly this agent’s current preauthorized synthetic workflow step. The service enforces role, agreement, disclosure, proof and replay checks.',
  inputSchema: { expectedStep: z.number().int().min(0).max(9) },
}, async ({ expectedStep }) => call('/turn', { expectedStep }));
await server.connect(new StdioServerTransport());
