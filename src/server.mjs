import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ResearchSession, steps } from './session.mjs';
import { localRequest, jsonBody, securityHeaders } from './http-security.mjs';

const port = Number(process.env.PORT ?? 7410);
const session = new ResearchSession({ proofsEnabled: process.argv.includes('--proofs'), lightnet: process.argv.includes('--lightnet'), zeko: process.argv.includes('--zeko') });
const tokens = new Map(), adminTokens = new Map();
for (const scope of ['operator', 'a', 'b']) {
  const token = randomBytes(32).toString('base64url'); adminTokens.set(token, scope);
  const dir = scope === 'operator' ? '.local' : `.local/company-${scope}`;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(`${dir}/admin.access.json`, JSON.stringify({ scope, caseId: session.caseId, token, baseUrl: `http://127.0.0.1:${port}` }), { mode: 0o600 });
}
let initialized = false, initializationError;
const server = http.createServer(async (req, res) => {
  securityHeaders(res); res.setHeader('content-type', 'application/json');
  try {
    localRequest(req, port);
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const scope = adminTokens.get(bearer), agent = tokens.get(bearer);
    if (!scope && !agent) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
    if (scope && req.method === 'GET' && req.url === '/admin/status') {
      res.end(JSON.stringify({ scope, initialized, ...(initializationError ? { initializationError } : {}), status: session.status(), controls: session.controls.view(scope),
        steps: steps.map(([id, label], index) => ({ index, agent: id, label })),
        deliveredEnvelopes: session.receipts.length, identity: session.identityStatus ?? (initialized ? 'simulated-presentations-verified' : 'initializing') })); return;
    }
    if (scope && req.method === 'POST' && req.url === '/admin/review') {
      res.end(JSON.stringify(session.controls.decide(scope, await jsonBody(req)))); return;
    }
    if (!agent) { res.writeHead(403); res.end(JSON.stringify({ error: 'scope_denied' })); return; }
    if (!initialized) throw new Error(initializationError ?? 'initializing');
    if (req.method === 'GET' && req.url === '/status') { res.end(JSON.stringify(session.status(agent))); return; }
    if (req.method === 'POST' && req.url === '/turn') {
      const input = await jsonBody(req);
      if (!Number.isInteger(input.expectedStep) || Object.keys(input).some(k => k !== 'expectedStep')) throw new Error('invalid_turn_request');
      if (!session.status(agent).canAct || input.expectedStep !== session.index) throw new Error('wrong_agent_or_stale_turn');
      const running = session.takeTurn(agent, input.expectedStep);
      running.catch(error => console.error('Turn stopped:', error.message));
      res.writeHead(202); res.end(JSON.stringify({ accepted: true, caseId: session.caseId, expectedStep: input.expectedStep })); return;
    }
    res.writeHead(404); res.end(JSON.stringify({ error: 'not_found' }));
  } catch (error) { res.writeHead(409); res.end(JSON.stringify({ error: error.message })); }
});
server.requestTimeout = 20 * 60 * 1000;
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
function close() { session.close(); server.close(); }
process.on('SIGINT', () => { close(); process.exit(); });
process.on('SIGTERM', () => { close(); process.exit(); });
try {
  await session.initialize();
  for (const id of Object.keys(session.identities)) {
    const token = randomBytes(32).toString('base64url'); tokens.set(token, id);
    const dir = `.local/company-${id[0]}`;
    writeFileSync(`${dir}/${id}.access.json`, JSON.stringify({ agentId: id, token, caseId: session.caseId, baseUrl: `http://127.0.0.1:${port}` }), { mode: 0o600 });
  }
  initialized = true;
  console.error(`Research API ready on loopback port ${port}; scoped credentials remain in .local.`);
} catch (error) { initializationError = error.message; console.error('Initialization failed:', error.message); close(); process.exitCode = 1; }
