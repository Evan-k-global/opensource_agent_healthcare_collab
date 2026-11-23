import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { startIdentityAdapter, signHolder, verifyPresentation } from '../src/identity.mjs';
const claims = org => ({ synthetic: true, organization: { id: `synthetic-research-${org}`, agentRegistryHash: 'a'.repeat(64), chainPublicKey: 'dummy-chain-key' }, datasetCommitment: '123',
  ...(org === 'b' ? { patient: { subjectCommitment: 'b'.repeat(64), computationCommitment: '456', idPresent: true, ageAtLeast: 18, ageEligible: true, conditionPolicy: 'synthetic-H1', conditionEligible: true } } : {}) });
test('identity HTTP handshake binds issuer, holder, case, audience and one-time nonce', async () => {
  let now = Date.now(); const adapter = await startIdentityAdapter({ now: () => now }); const key = generateKeyPairSync('ed25519');
  try {
    const challenge = await adapter.call('/v1/challenges', { org: 'b', audience: 'a', caseId: 'case-1', holderKey: key.publicKey.export({ format: 'jwk' }) });
    const input = { challenge, claims: claims('b'), holderSignature: signHolder(key.privateKey, challenge, claims('b')) };
    const presentation = await adapter.call('/v1/presentations', input);
    assert(verifyPresentation(presentation, adapter.issuerKey, challenge).verified);
    await assert.rejects(() => adapter.call('/v1/presentations', input), /replayed/);
    assert.throws(() => verifyPresentation(presentation, adapter.issuerKey, { ...challenge, caseId: 'case-2' }), /binding/);
    assert.throws(() => verifyPresentation(presentation, adapter.issuerKey, { ...challenge, audience: 'b' }), /binding/);
    const tampered = structuredClone(presentation); tampered.payload.claims.patient.ageEligible = false;
    assert.throws(() => verifyPresentation(tampered, adapter.issuerKey, challenge), /signature/);
    assert.throws(() => verifyPresentation(presentation, adapter.issuerKey, challenge, now + 3600001), /expired/);
    const c2 = await adapter.call('/v1/challenges', { org: 'a', audience: 'b', caseId: 'case-1', holderKey: key.publicKey.export({ format: 'jwk' }) });
    await assert.rejects(() => adapter.call('/v1/presentations', { challenge: c2, claims: claims('a'), holderSignature: signHolder(generateKeyPairSync('ed25519').privateKey, c2, claims('a')) }), /holder/);
    const raw = { ...claims('a'), patientId: 'SECRET_PATIENT' };
    await assert.rejects(() => adapter.call('/v1/presentations', { challenge: c2, claims: raw, holderSignature: signHolder(key.privateKey, c2, raw) }));
    now += 300001;
    await assert.rejects(() => adapter.call('/v1/presentations', { challenge: c2, claims: claims('a'), holderSignature: signHolder(key.privateKey, c2, claims('a')) }), /expired/);
  } finally { adapter.close(); }
});
