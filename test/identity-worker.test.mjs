import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startCompany } from '../src/worker-client.mjs';
import { startIdentityAdapter } from '../src/identity.mjs';
import { digest } from '../src/workshop.mjs';

test('company workers bind identity to their session, enrolled agents and computation plan', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'research-identity-'));
  const workers = Object.fromEntries(['a','b'].map(org => [org, startCompany(org, { env: { COMPANY_OUTPUT: join(directory, org) } })]));
  const adapter = await startIdentityAdapter();
  try {
    const enrolled = {};
    for (const org of ['a','b']) enrolled[org] = await workers[org].call('init', { caseId: 'bound-case' });
    const identities = { ...enrolled.a.identities, ...enrolled.b.identities };
    for (const worker of Object.values(workers)) await worker.call('configure', { identities });
    const presentations = {}, challenges = {};
    for (const org of ['a','b']) {
      challenges[org] = await adapter.call('/v1/challenges', { caseId: 'bound-case', org, audience: org === 'a' ? 'b' : 'a', holderKey: enrolled[org].holderKey });
      presentations[org] = await adapter.call('/v1/presentations', await workers[org].call('identityClaims', { challenge: challenges[org] }));
    }
    const handshake = { presentations, challenges, issuerKey: adapter.issuerKey };
    assert.equal((await workers.a.call('identityHandshake', handshake)).verified, true);
    const wrongCase = structuredClone(handshake); wrongCase.challenges.b.caseId = 'other-case';
    await assert.rejects(() => workers.a.call('identityHandshake', wrongCase), /identity_session_mismatch/);
    await workers.b.call('configure', { identities: { ...identities, 'a-researcher': { ...identities['a-researcher'], id: 'substituted-agent' } } });
    await assert.rejects(() => workers.b.call('identityHandshake', handshake), /identity_agent_registry_mismatch/);
    await workers.b.call('configure', { identities });
    assert.equal((await workers.b.call('identityHandshake', handshake)).verified, true);
    await assert.rejects(() => workers.a.call('agree', { proposedPlan: { identityHandshake: 'changed' } }), /identity_handshake_missing_or_changed/);
    await assert.rejects(() => workers.a.call('agree', { proposedPlan: {
      identityHandshake: digest(presentations), aDataset: enrolled.a.dataset, bDataset: 'changed', patient: enrolled.b.patient,
    } }), /identity_plan_commitments_mismatch/);
  } finally {
    adapter.close();
    for (const worker of Object.values(workers)) worker.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
