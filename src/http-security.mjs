import { timingSafeEqual } from 'node:crypto';
export function authenticate(req, token) {
  const actual = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /, ''));
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function localRequest(req, port, browser = false) {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) throw new Error('local_host_required');
  if (req.headers.origin && (!browser || req.headers.origin !== `http://${req.headers.host}`)) throw new Error('origin_denied');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error('cross_site_denied');
}
export async function jsonBody(req, limit = 4096) {
  let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > limit) throw new Error('body_too_large'); }
  return JSON.parse(body || '{}');
}
export function securityHeaders(res) {
  res.setHeader('cache-control', 'no-store'); res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer'); res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}
