// Run on the company host: private reports never pass through the coordinator.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { authenticate, jsonBody, localRequest, securityHeaders } from './http-security.mjs';
const accessFile = process.env.ADMIN_ACCESS_FILE;
if (!accessFile) throw new Error('ADMIN_ACCESS_FILE_required');
const access = JSON.parse(readFileSync(accessFile));
if (!['operator', 'a', 'b'].includes(access.scope)) throw new Error('invalid_admin_scope');
const upstream = new URL(access.baseUrl);
if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(upstream.hostname)) throw new Error('loopback_api_required');
const port = Number(process.env.ADMIN_PORT ?? (access.scope === 'operator' ? 7420 : access.scope === 'a' ? 7421 : 7422));
const publicFiles = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  try {
    localRequest(req, port, true);
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && publicFiles[req.url]) {
      const [file, type] = publicFiles[req.url]; res.setHeader('content-type', type);
      res.end(readFileSync(new URL(`../web/${file}`, import.meta.url))); return;
    }
    res.setHeader('content-type', 'application/json');
    if (!authenticate(req, access.token)) { res.writeHead(401); res.end(JSON.stringify({ error: 'Use this administrator’s private access link.' })); return; }
    const view = req.method === 'GET' && req.url === '/api/view';
    const review = req.method === 'POST' && req.url === '/api/review';
    if (!view && !review) { res.writeHead(404); res.end('{}'); return; }
    const response = await fetch(access.baseUrl + (view ? '/admin/status' : '/admin/review'), {
      method: view ? 'GET' : 'POST', headers: { authorization: `Bearer ${access.token}`, 'content-type': 'application/json' },
      ...(review ? { body: JSON.stringify(await jsonBody(req)) } : {}), signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    const data = await response.json();
    if (response.ok && view && access.scope !== 'operator') {
      try {
        const report = JSON.parse(readFileSync(join(dirname(resolve(accessFile)), 'admin-report.json')));
        if (report.company === access.scope && report.caseId === data.status.caseId) data.privateReport = report;
      } catch { /* Report is not ready yet. */ }
    }
    res.writeHead(response.status); res.end(JSON.stringify(data));
  } catch (error) { res.writeHead(409); res.end(JSON.stringify({ error: error.message })); }
});
server.listen(port, '127.0.0.1', () => console.error(`Administrator view (${access.scope}) on http://127.0.0.1:${port}; authenticate with the private access link.`));
process.on('SIGTERM', () => server.close()); process.on('SIGINT', () => server.close());
