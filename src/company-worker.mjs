import { generateKeyPairSync } from 'node:crypto';
import { signHolder, verifyPresentation } from './identity.mjs';
import { advise } from './intelligence.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Field, UInt32, PrivateKey, Signature, Bool } from 'o1js';
import { makeCompanyIdentity, publicIdentity, sealMessage, openMessage, digest, WorkshopRelay } from './workshop.mjs';
import { ResearchContext, JointContext, ResearchProgram, ResearchProof, JointProgram, hashRows, hashPatient, hashAggregate, hashResult, compileProofs, planAuthorization } from './proofs.mjs';

const org = process.env.COMPANY;
if (!['a', 'b'].includes(org)) throw new Error('COMPANY must be a or b');
const directory = resolve(process.env.COMPANY_DATA ?? `fixtures/company-${org}`);
const localDirectory = resolve(process.env.COMPANY_OUTPUT ?? `.local/company-${org}`);
mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
const research = JSON.parse(readFileSync(`${directory}/research.json`, 'utf8'));
const patient = org === 'b' ? JSON.parse(readFileSync(`${directory}/patient.json`, 'utf8')) : null;
if (research.synthetic !== true || (patient && patient.synthetic !== true)) throw new Error('synthetic_data_required');
const rows = research.records.map(value => UInt32.from(value));
if (rows.length !== 4 || research.records.some(v => !Number.isInteger(v) || v < 0 || v > 100)) throw new Error('invalid_fixture');
const dataSalt = Field.random(), patientSalt = Field.random(), outputSalt = Field.random();
const dataset = hashRows(rows, dataSalt).toString();
const patientCommitment = patient ? hashPatient(UInt32.from(patient.featureScore), patientSalt).toString() : null;
const chainKey = PrivateKey.random();
const holder = generateKeyPairSync("ed25519");
const advice = [];
let handshake, issuerKey;
let identity, registry, relayVerifier, caseId, plan, context, aggregate, aResult, computed = false, agreed = false;
let receivedPlan = null;
const privateTranscript = [];
const fieldDigest = value => Field(BigInt(`0x${digest(value)}`) % Field.ORDER).toString();
function logPrivate(entry) {
  privateTranscript.push(entry);
  writeAdmin();
  writeFileSync(`${localDirectory}/transcript.json`, JSON.stringify(privateTranscript, null, 2), { mode: 0o600 });
}
function writeAdmin() {
  const rooms = Object.fromEntries([`${org}-internal`, 'bilateral-planning'].map(channel => [channel,
    privateTranscript.filter(e => e.channel === channel).map(e => ({ direction: e.direction, sender: e.sender, recipient: e.recipient,
      type: e.body.type, summary: e.body.text ?? 'Approved aggregate delivered; opening omitted from this summary.' }))]));
  const report = { synthetic: true, company: org, caseId, rooms, modelAdvice: advice, identityHandshake: handshake ? (handshake.presentations[org].payload.simulated ? 'verified-simulated-attestations' : 'verified-local-attestation-of-reclaim-evidence') : 'pending',
    limitations: ['Model advice is private and advisory', 'Human approvals, when enabled, are recorded separately by the coordinator', handshake?.presentations[org].payload.simulated === false ? 'External evidence verified by trusted local adapter, not inside this circuit' : 'No real zkTLS/KYC verified'] };
  writeFileSync(`${localDirectory}/admin-report.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
}
function assertReady() { if (!agreed || computed) throw new Error('company_compute_not_authorized_or_replayed'); }
const handlers = {
  init(input) {
    caseId = input.caseId; identity = makeCompanyIdentity(org, caseId);
    return { identities: publicIdentity(identity), dataset, patient: patientCommitment, chainPublicKey: chainKey.toPublicKey().toBase58(), holderKey: holder.publicKey.export({ format: 'jwk' }) };
  },
  configure(input) {
    registry = input.identities;
    relayVerifier = new WorkshopRelay({ caseId, identities: registry });
    return { configured: true };
  },
  identityClaims({ challenge }) {
    if (challenge.caseId !== caseId || challenge.org !== org || challenge.holderKeyHash !== digest(holder.publicKey.export({ format: 'jwk' }))) throw new Error('identity_challenge_mismatch');
    const claims = { synthetic: true, organization: { id: `synthetic-research-${org}`, agentRegistryHash: digest(publicIdentity(identity)), chainPublicKey: chainKey.toPublicKey().toBase58() }, datasetCommitment: dataset,
      ...(patient ? { patient: { subjectCommitment: digest({ caseId, patientId: patient.patientId, salt: patientSalt.toString() }), computationCommitment: patientCommitment, idPresent: Boolean(patient.patientId), ageAtLeast: 18, ageEligible: patient.age >= 18, conditionPolicy: 'synthetic-H1', conditionEligible: patient.condition === 'synthetic-H1' } } : {}) };
    return { challenge, claims, holderSignature: signHolder(holder.privateKey, challenge, claims) };
  },
  identityHandshake(input) {
    for (const company of ['a','b']) {
      const challenge = input.challenges[company];
      if (challenge.caseId !== caseId || challenge.org !== company || challenge.audience !== (company === 'a' ? 'b' : 'a')) throw new Error('identity_session_mismatch');
      verifyPresentation(input.presentations[company], input.issuerKey, challenge);
      const enrolled = Object.fromEntries(Object.entries(registry).filter(([id]) => id.startsWith(`${company}-`)));
      if (input.presentations[company].payload.claims.organization.agentRegistryHash !== digest(enrolled)) throw new Error('identity_agent_registry_mismatch');
    }
    if (input.challenges[org].holderKeyHash !== digest(holder.publicKey.export({ format: 'jwk' }))) throw new Error('identity_holder_mismatch');
    const mine = input.presentations[org].payload.claims;
    if (mine.datasetCommitment !== dataset || mine.organization.chainPublicKey !== chainKey.toPublicKey().toBase58() || mine.organization.agentRegistryHash !== digest(publicIdentity(identity))) throw new Error('identity_claims_mismatch');
    if (org === 'b' && mine.patient.computationCommitment !== patientCommitment) throw new Error('patient_commitment_mismatch');
    handshake = input; issuerKey = input.issuerKey; writeAdmin();
    return { verified: true, handshakeHash: digest(input.presentations) };
  },
  async advise({ role, action, humanReview = false }) {
    if (!identity.agents[`${org}-${role}`]) throw new Error('unknown_role');
    const result = await advise({ org, role, action, humanReview }); advice.push({ action, ...result }); writeAdmin();
    return { decision: result.decision, mode: result.mode, role: result.role };
  },
  admin() { writeAdmin(); return { company: org, messages: privateTranscript.length, adviceCount: advice.length }; },
  message({ role, recipient, channel, template, planHash }) {
    const agent = identity.agents[`${org}-${role}`];
    if (!agent) throw new Error('unknown_role');
    const messages = {
      discuss: { type: 'internal_discussion', text: 'Use the fixed synthetic-support-v1 circuit. Keep raw records local.' },
      review: { type: 'internal_review', text: 'Release only the approved aggregate opening to B. Keep research rows and patient features private.' },
      propose: { type: 'plan_proposal', planHash, text: 'Propose one proof-backed synthetic hypothesis check with aggregate-only disclosure.' },
      accept: { type: 'plan_acceptance', planHash, text: 'Agree to the same circuit, dataset commitments, disclosure and one-run budget.' },
      aggregate: aggregate ? { type: 'approved_aggregate', ...aggregate } : undefined,
    };
    if (!messages[template]) throw new Error('invalid_or_unavailable_message_template');
    if (channel === 'bilateral-planning' && (!['propose', 'accept', 'aggregate'].includes(template) || role !== 'liaison')) throw new Error('bilateral_disclosure_denied');
    if (template === 'aggregate' && (org !== 'a' || !computed || recipient !== 'b-liaison')) throw new Error('aggregate_disclosure_denied');
    const packet = sealMessage(agent, registry[recipient], { caseId, channel, body: messages[template], kind: template === 'aggregate' ? 'artifact_notice' : 'question' });
    logPrivate({ direction: 'sent', sender: agent.id, recipient, channel, body: messages[template] });
    return packet;
  },
  receive({ packet }) {
    relayVerifier.post(packet);
    const agent = identity.agents[packet.envelope.recipient.agentId];
    if (!agent) throw new Error('not_a_company_recipient');
    const body = openMessage(agent, packet);
    if (['plan_proposal', 'plan_acceptance'].includes(body.type)) receivedPlan = body.planHash;
    if (body.type === 'approved_aggregate') {
      if (org !== 'b' || packet.envelope.sender.agentId !== 'a-liaison') throw new Error('invalid_aggregate_sender');
      aggregate = body;
    }
    logPrivate({ direction: 'received', sender: packet.envelope.sender.agentId, recipient: agent.id, channel: packet.envelope.channelId, body });
    return { received: true, messageId: packet.envelope.messageId, type: body.type };
  },
  agree({ proposedPlan }) {
    if (!handshake || proposedPlan.identityHandshake !== digest(handshake.presentations)) throw new Error('identity_handshake_missing_or_changed');
    for (const company of ['a','b']) verifyPresentation(handshake.presentations[company], issuerKey, handshake.challenges[company]);
    if (proposedPlan.aDataset !== handshake.presentations.a.payload.claims.datasetCommitment || proposedPlan.bDataset !== handshake.presentations.b.payload.claims.datasetCommitment || proposedPlan.patient !== handshake.presentations.b.payload.claims.patient.computationCommitment) throw new Error('identity_plan_commitments_mismatch');
    if (receivedPlan !== digest(proposedPlan)) throw new Error('bilateral_agreement_missing');
    if (proposedPlan[`${org}Dataset`] !== dataset || (org === 'b' && proposedPlan.patient !== patientCommitment)) throw new Error('local_dataset_not_in_plan');
    if (proposedPlan.algorithm !== 'synthetic-support-v1' || proposedPlan.threshold !== 500 || proposedPlan.maxRuns !== 1 || proposedPlan.caseId !== caseId) throw new Error('unsupported_plan');
    plan = proposedPlan;
    context = new JointContext({ caseId: Field(fieldDigest(caseId)), plan: Field(fieldDigest(plan)), aDataset: Field(plan.aDataset), bDataset: Field(plan.bDataset), patient: Field(plan.patient) });
    agreed = true;
    return { agreed: true, planHash: digest(plan) };
  },
  async compute({ proofsEnabled }) {
    if (org !== 'a') throw new Error('only_a_computes_initial_aggregate');
    assertReady(); computed = true;
    await ResearchProgram.compile({ proofsEnabled, cache: (await import('o1js')).Cache.FileSystem('.cache/o1js') });
    const input = new ResearchContext({ caseId: context.caseId, plan: context.plan, dataset: Field(dataset) });
    const { proof } = await ResearchProgram.compute(input, rows, dataSalt, outputSalt);
    const total = research.records.reduce((a, b) => a + b, 0);
    aggregate = { total, salt: outputSalt.toString(), commitment: hashAggregate(UInt32.from(total), outputSalt).toString() };
    aResult = proof;
    return { proof: proof.toJSON(), outputCommitment: proof.publicOutput.toString() };
  },
  async combine({ aProof, proofsEnabled }) {
    if (org !== 'b' || !aggregate) throw new Error('approved_aggregate_required');
    assertReady(); computed = true;
    await compileProofs({ proofsEnabled });
    const finalSalt = Field.random();
    const { proof } = await JointProgram.combine(context, await ResearchProof.fromJSON(aProof), rows, dataSalt,
      UInt32.from(patient.featureScore), patientSalt, UInt32.from(aggregate.total), Field(aggregate.salt), finalSalt);
    const supported = aggregate.total + research.records.reduce((a, b) => a + b, 0) + patient.featureScore >= 500;
    const report = {
      synthetic: true, hypothesis: 'H1 (fictional)', supported, clinicalMeaning: 'None; arithmetic demonstration only.',
      resultSalt: finalSalt.toString(), resultCommitment: hashResult(Bool(supported), finalSalt).toString(),
    };
    writeFileSync(`${localDirectory}/private-result.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
    return { proof: proof.toJSON(), outputCommitment: proof.publicOutput.toString() };
  },
  authorize({ address, publicInput }) {
    if (!agreed) throw new Error('plan_not_agreed');
    const requested = JointContext.fromJSON(publicInput);
    if (JSON.stringify(JointContext.toJSON(requested)) !== JSON.stringify(JointContext.toJSON(context))) throw new Error('settlement_plan_mismatch');
    return { signature: Signature.create(chainKey, planAuthorization(PublicKey.fromBase58(address), context)).toBase58() };
  },
};
// Keep key parsing out of IPC payloads; only the public address is received.
import { PublicKey } from 'o1js';
let chain = Promise.resolve();
function send(message) {
  if (process.send) process.send(message);
  else process.stdout.write(JSON.stringify(message) + '\n');
}
function handle(request) {
  chain = chain.then(async () => {
    try {
      if (!handlers[request.method]) throw new Error('unknown_company_method');
      const result = await handlers[request.method](request.params ?? {});
      send({ id: request.id, result });
    } catch (error) { send({ id: request.id, error: error.message }); }
  });
}
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
if (process.send) process.on('message', handle);
else createInterface({ input: process.stdin }).on('line', line => {
  try { handle(JSON.parse(line)); } catch { send({ error: 'invalid_request_json' }); }
}).on('close', () => { chain.finally(() => process.exit(0)); });
