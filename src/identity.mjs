import { z } from 'zod';
import http from 'node:http';
import { generateKeyPairSync, randomUUID, randomBytes, createPublicKey, sign, verify } from 'node:crypto';
import { digest } from './workshop.mjs';
const claimsSchema = z.object({ synthetic: z.literal(true), organization: z.object({ id: z.string().max(80), agentRegistryHash: z.string().regex(/^[a-f0-9]{64}$/), chainPublicKey: z.string().max(100) }).strict(), datasetCommitment: z.string().regex(/^\d+$/),
  patient: z.object({ subjectCommitment: z.string().regex(/^[a-f0-9]{64}$/), computationCommitment: z.string().regex(/^\d+$/), idPresent: z.boolean(), ageAtLeast: z.literal(18), ageEligible: z.boolean(), conditionPolicy: z.literal('synthetic-H1'), conditionEligible: z.boolean() }).strict().optional() }).strict();
const bytes = value => Buffer.from(JSON.stringify(value));
export const IDENTITY_SCHEME = 'simulated-zktls-zkkyc-signed-attestation-v1';
export const RECLAIM_SCHEME = 'reclaim-verified-local-attestation-v1';
export function signHolder(privateKey, challenge, claims) { return sign(null, bytes({ challenge, claims }), privateKey).toString('base64url'); }
export function verifyPresentation(presentation, issuerKey, expected, now = Date.now()) {
  const { payload, signature } = presentation;
  if (!verify(null, bytes(payload), createPublicKey({ key: issuerKey, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new Error('identity_signature_invalid');
  claimsSchema.parse(payload.claims);
  if (!(payload.scheme === IDENTITY_SCHEME && payload.simulated === true) && !(payload.scheme === RECLAIM_SCHEME && payload.simulated === false && payload.providerEvidence?.provider === 'reclaim' && payload.providerEvidence?.verified === true)) throw new Error('unsupported_identity_provider');
  if (payload.expiresAt <= now || payload.issuedAt > now + 5000) throw new Error('identity_expired_or_future');
  for (const key of ['caseId', 'org', 'audience', 'nonce', 'holderKeyHash']) if (payload.challenge[key] !== expected[key]) throw new Error(`identity_binding_${key}`);
  if (payload.claims.organization.id !== `synthetic-research-${expected.org}`) throw new Error('organization_mismatch');
  if (expected.org === 'b' && (!payload.claims.patient?.ageEligible || !payload.claims.patient?.conditionEligible || !payload.claims.patient?.idPresent)) throw new Error('patient_policy_failed');
  return { verified: true, simulated: payload.simulated, digest: digest(presentation) };
}
export async function startIdentityAdapter({ now = () => Date.now(), port = 0, provider = null } = {}) {
  const issuer = generateKeyPairSync('ed25519'), challenges = new Map(), token = randomBytes(32).toString('base64url');
  const issuerKey = issuer.publicKey.export({ format: 'jwk' });
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    try {
      if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401); res.end('{}'); return; }
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new Error('body_too_large'); }
      const input = JSON.parse(body || '{}');
      if (req.method === 'POST' && req.url === '/v1/challenges') {
        if (!['a','b'].includes(input.org) || input.audience !== (input.org === 'a' ? 'b' : 'a') || typeof input.caseId !== 'string') throw new Error('invalid_identity_context');
        const challenge = { caseId: input.caseId, org: input.org, audience: input.audience, holderKeyHash: digest(input.holderKey), nonce: randomUUID(), expiresAt: now() + 300000 };
        challenges.set(challenge.nonce, { challenge, holderKey: input.holderKey });
        res.end(JSON.stringify(challenge)); return;
      }
      if (req.method === 'POST' && req.url === '/v1/presentations') {
        const saved = challenges.get(input.challenge?.nonce);
        if (!saved || digest(saved.challenge) !== digest(input.challenge) || saved.challenge.expiresAt <= now()) throw new Error('challenge_expired_replayed_or_changed');
        if (!verify(null, bytes({ challenge: input.challenge, claims: input.claims }), createPublicKey({ key: saved.holderKey, format: 'jwk' }), Buffer.from(input.holderSignature, 'base64url'))) throw new Error('holder_proof_invalid');
        // Simulation provider: claims are dummy assertions, not externally verified
        // credentials, zkTLS transcripts, KYC evidence, or proofs of patient attributes.
        if (input.claims?.synthetic !== true || input.claims?.organization?.id !== `synthetic-research-${saved.challenge.org}`) throw new Error('synthetic_claims_required');
        claimsSchema.parse(input.claims);
        challenges.delete(saved.challenge.nonce); // Reserve once before any asynchronous provider call.
        const providerEvidence = provider ? await provider.obtain({ challenge: saved.challenge, claims: input.claims }) : null;
        const payload = { scheme: provider ? RECLAIM_SCHEME : IDENTITY_SCHEME, simulated: !provider, ...(providerEvidence ? { providerEvidence } : {}), issuer: 'local-dummy-issuer', challenge: saved.challenge, claims: input.claims, issuedAt: now(), expiresAt: now() + 3600000 };
        const presentation = { payload, signature: sign(null, bytes(payload), issuer.privateKey).toString('base64url') };
        verifyPresentation(presentation, issuerKey, saved.challenge, now());
        challenges.delete(saved.challenge.nonce);
        res.end(JSON.stringify(presentation)); return;
      }
      res.writeHead(404); res.end('{}');
    } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, token, issuerKey, async call(path, input) {
    const response = await fetch(baseUrl + path, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(provider ? 360000 : 10000) });
    const value = await response.json(); if (!response.ok) throw new Error(value.error ?? 'identity_adapter_failed'); return value;
  }, close: () => { provider?.close(); server.closeAllConnections(); server.close(); } };
}
