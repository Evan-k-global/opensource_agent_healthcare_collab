import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCompanyIdentity, publicIdentity, sealMessage, openMessage, WorkshopRelay } from '../src/workshop.mjs';
import { Workflow } from '../src/workflow.mjs';
import { buildAgentMessageEnvelope } from '../vendor/santaclawz/agent-communication/envelope.js';

const config = JSON.parse(readFileSync(new URL('../config/demo.json', import.meta.url)));
function setup() {
  const a = makeCompanyIdentity('a', 'case-1'), b = makeCompanyIdentity('b', 'case-1');
  const identities = { ...publicIdentity(a), ...publicIdentity(b) };
  const relay = new WorkshopRelay({ caseId: 'case-1', identities, maxMessages: 2 });
  const packet = () => sealMessage(a.agents['a-liaison'], identities['b-liaison'], {
    caseId: 'case-1', channel: 'bilateral-planning', body: { idea: 'PRIVATE_PRELIMINARY_IDEA' },
  });
  return { a, b, identities, relay, packet };
}
test('bilateral ideas are encrypted and only the addressed agent can decrypt', () => {
  const { a, b, relay, packet } = setup(); const p = packet(); relay.post(p);
  assert.equal(JSON.stringify(relay.messages).includes('PRIVATE_PRELIMINARY_IDEA'), false);
  assert.equal(openMessage(b.agents['b-liaison'], p).idea, 'PRIVATE_PRELIMINARY_IDEA');
  assert.throws(() => openMessage(a.agents['a-researcher'], p), /recipient_mismatch/);
});
test('internal agents cannot join the bilateral channel or read the other company channel', () => {
  const { a, identities, relay } = setup();
  assert.throws(() => sealMessage(a.agents['a-researcher'], identities['b-liaison'], { caseId: 'case-1', channel: 'bilateral-planning', body: {} }), /denied/);
  assert.throws(() => relay.read('b-liaison', 'a-internal'), /denied/);
  assert.throws(() => relay.read('b-researcher', 'bilateral-planning'), /denied/);
});
test('replay and budget limits are enforced even when optional checkpoints are off', () => {
  const { relay, packet } = setup(); const p = packet(); relay.post(p);
  assert.throws(() => relay.post(p), /replay/);
  relay.post(packet()); assert.throws(() => relay.post(packet()), /budget/);
});
test('rehashed ciphertext substitution fails the holder signature binding', () => {
  const { relay, packet } = setup(); const p = packet();
  p.envelope = buildAgentMessageEnvelope({ ...p.envelope, payload: { ...p.envelope.payload, body: 'tampered' } });
  assert.throws(() => relay.post(p), /binding/);
});
test('cross-case routing and capability substitution are rejected', () => {
  const { relay, packet, identities } = setup(); const p = packet();
  p.envelope = buildAgentMessageEnvelope({ ...p.envelope, threadId: 'another-case' });
  assert.throws(() => relay.post(p), /context/);
  const q = packet(); q.capability = identities['b-liaison'].capability;
  assert.throws(() => relay.post(q), /scope/);
});
test('private compute requires both companies to agree on the identical plan', async () => {
  const w = new Workflow(config);
  await assert.rejects(() => w.beforeCompute('a'), /not_authorized/);
  await w.agree('a', { algorithm: 'one' });
  await assert.rejects(() => w.agree('b', { algorithm: 'two' }), /mismatch/);
  await w.agree('b', { algorithm: 'one' });
  await assert.rejects(() => w.beforeCompute('unregistered-company'), /not_authorized/);
  await w.beforeCompute('a');
  await assert.rejects(() => w.beforeCompute('a'), /replayed/);
  await assert.rejects(() => w.beforeSettle(), /not_ready/);
  await w.beforeCompute('b'); await w.beforeSettle(); w.settled();
  assert.equal(w.state, 'settled');
  assert(w.events.every(e => e.humanReview === 'disabled'));
});
test('enabled human review fails closed without an approver and honors denial', async () => {
  const c = structuredClone(config); c.humanReview.enabled = true;
  await assert.rejects(() => new Workflow(c).agree('a', {}), /human_review_required/);
  await assert.rejects(() => new Workflow(c, { review: async () => false }).agree('a', {}), /human_review_denied/);
  let reviewed;
  const w = new Workflow(c, { review: async request => { reviewed = request; return true; } }); await w.agree('a', { algorithm: 'one' });
  assert.deepEqual(reviewed.plan, { algorithm: 'one' });
  assert.equal(typeof reviewed.planHash, 'string');
  assert.equal(w.events[0].humanReview, 'approved');
});
test('fixed circuit settings cannot silently drift from configuration', () => {
  assert.throws(() => new Workflow({ ...config, threshold: 501 }), /unsupported_fixed/);
  assert.throws(() => new Workflow({ ...config, maxComputeRunsPerCompany: 2 }), /unsupported_fixed/);
});
test('model routing is optional and cannot invent an unauthorized role', async () => {
  const w = new Workflow(config); assert.deepEqual(await w.route('liaison'), { role: 'liaison', source: 'deterministic' });
  const c = structuredClone(config); c.modelRouting.enabled = true;
  await assert.rejects(() => new Workflow(c).route('liaison'), /not_configured/);
  await assert.rejects(() => new Workflow(c, { route: async () => 'administrator' }).route('liaison'), /invalid_model_route/);
});
