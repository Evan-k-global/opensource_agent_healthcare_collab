import { startIdentityAdapter, verifyPresentation } from './identity.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Field, UInt64, Mina, AccountUpdate, PrivateKey, PublicKey, Signature, Poseidon, Lightnet, fetchAccount, verify } from 'o1js';
import { JointContext, JointProof, CollaborationRegistry, compileProofs, planAuthorization } from './proofs.mjs';
import { startCompany } from './worker-client.mjs';
import { WorkshopRelay, digest } from './workshop.mjs';
import { Workflow } from './workflow.mjs';
import { createReclaimProvider } from './reclaim-provider.mjs';
import { Controls } from './controls.mjs';

const fieldDigest = value => Field(BigInt(`0x${digest(value)}`) % Field.ORDER);
export const steps = [
  ['a-researcher', 'Discuss research plan privately', 'discuss', 'a-reviewer', 'a-internal'],
  ['a-reviewer', 'Review A disclosure policy', 'review', 'a-liaison', 'a-internal'],
  ['b-researcher', 'Discuss patient-side plan privately', 'discuss', 'b-reviewer', 'b-internal'],
  ['b-reviewer', 'Review B disclosure policy', 'review', 'b-liaison', 'b-internal'],
  ['a-liaison', 'Propose bilateral plan', 'propose', 'b-liaison', 'bilateral-planning'],
  ['b-liaison', 'Agree bilateral plan', 'accept', 'a-liaison', 'bilateral-planning'],
  ['a-researcher', 'Prove A private research aggregate', 'compute-a'],
  ['a-liaison', 'Deliver approved aggregate encrypted to B', 'aggregate', 'b-liaison', 'bilateral-planning'],
  ['b-researcher', 'Prove joint result using private B inputs', 'compute-b'],
  ['b-reviewer', 'Verify and settle the joint result', 'settle'],
];
export class ResearchSession {
  constructor({ proofsEnabled = false, lightnet = false, zeko = false, config, handlers } = {}) {
    if (lightnet && zeko) throw new Error('choose_one_network');
    if ((lightnet || zeko) && !proofsEnabled) throw new Error('network_mode_requires_real_proofs');
    this.proofsEnabled = proofsEnabled; this.lightnet = lightnet; this.zeko = zeko; this.remote = lightnet || zeko;
    this.config = config ?? JSON.parse(readFileSync(new URL('../config/demo.json', import.meta.url)));
    this.config = structuredClone(this.config);
    if (process.env.HUMAN_REVIEW === '1') this.config.humanReview.enabled = true;
    if (process.env.MODEL_ROUTING === '1') this.config.modelRouting.enabled = true;
    this.caseId = randomUUID();
    this.controls = new Controls(this.caseId, { changed: () => { if (this.relay) this.persist(); } });
    this.workflow = new Workflow(this.config, handlers ?? { review: request => this.controls.review(request), route: request => this.controls.route(request) });
    this.index = 0; this.inflight = false; this.failed = false; this.receipts = []; this.started = Date.now();
    this.workers = { a: startCompany('a'), b: startCompany('b') };
  }
  async initialize() {
    this.a = await this.workers.a.call('init', { caseId: this.caseId });
    this.b = await this.workers.b.call('init', { caseId: this.caseId });
    this.identities = { ...this.a.identities, ...this.b.identities };
    this.relay = new WorkshopRelay({ caseId: this.caseId, identities: this.identities, maxMessages: this.config.maxBilateralMessagesPerAgent });
    for (const worker of Object.values(this.workers)) await worker.call('configure', { identities: this.identities });
    this.identityStatus = process.env.IDENTITY_PROVIDER_CONFIG ? 'awaiting-external-provider' : 'simulated';
    const provider = process.env.IDENTITY_PROVIDER_CONFIG ? await createReclaimProvider(JSON.parse(readFileSync(process.env.IDENTITY_PROVIDER_CONFIG))) : null;
    this.identityAdapter = await startIdentityAdapter({ provider });
    const presentations = {}, challenges = {};
    for (const org of ['a', 'b']) {
      challenges[org] = await this.identityAdapter.call('/v1/challenges', { org, audience: org === 'a' ? 'b' : 'a', caseId: this.caseId, holderKey: this[org].holderKey });
      const request = await this.workers[org].call('identityClaims', { challenge: challenges[org] });
      presentations[org] = await this.identityAdapter.call('/v1/presentations', request);
      verifyPresentation(presentations[org], this.identityAdapter.issuerKey, challenges[org]);
    }
    this.handshake = { presentations, challenges, issuerKey: this.identityAdapter.issuerKey };
    this.identityStatus = provider ? 'reclaim-verified-by-off-chain-adapter' : 'simulated-presentations-verified';
    for (const org of ['a','b']) await this.workers[org].call('identityHandshake', this.handshake);
    mkdirSync('.local', { recursive: true, mode: 0o700 });
    writeFileSync('.local/identity-handshake.json', JSON.stringify(this.handshake, null, 2), { mode: 0o600 });
    writeFileSync('.local/identity-adapter.json', JSON.stringify({ baseUrl: this.identityAdapter.baseUrl, token: this.identityAdapter.token, issuerKey: this.identityAdapter.issuerKey, simulated: !provider }), { mode: 0o600 });
    this.plan = {
      identityHandshake: digest(presentations),
      caseId: this.caseId, algorithm: 'synthetic-support-v1', threshold: 500, maxRuns: 1,
      aDataset: this.a.dataset, bDataset: this.b.dataset, patient: this.b.patient,
      disclosure: 'A-approved-aggregate-to-B; final-opening-stays-at-B',
      authorization: this.config.humanReview.enabled ? 'synthetic; company-scoped human checkpoints required' : 'synthetic-preauthorized; no human approval claimed',
    };
    this.context = new JointContext({ caseId: fieldDigest(this.caseId), plan: fieldDigest(this.plan), aDataset: Field(this.a.dataset), bDataset: Field(this.b.dataset), patient: Field(this.b.patient) });
    this.persist();
    return this.status();
  }
  status(agentId) {
    if (agentId && !this.identities?.[agentId]) throw new Error('unknown_agent');
    const next = steps[this.index];
    return {
      schema: 'research-demo-status/1', synthetic: true, caseId: this.caseId, busy: this.inflight, state: this.failed ? 'failed' : this.workflow.state,
      ...(this.failureReason ? { failureReason: this.failureReason } : {}),
      proofMode: this.proofsEnabled ? 'real-o1js' : 'simulation-no-cryptographic-proof',
      step: this.index, totalSteps: steps.length, nextAgent: next?.[0] ?? null, nextAction: next?.[1] ?? null,
      canAct: !this.inflight && !this.failed && next?.[0] === agentId,
      humanReview: this.config.humanReview.enabled, modelRouting: this.config.modelRouting.enabled,
      ...(this.report ? { report: this.report } : {}),
    };
  }
  async takeTurn(agentId, expectedStep = this.index) {
    if (this.inflight) throw new Error('turn_in_progress');
    if (this.failed) throw new Error('session_failed_restart_required');
    const step = steps[this.index];
    if (!step || step[0] !== agentId || expectedStep !== this.index) throw new Error('wrong_agent_or_stale_turn');
    this.inflight = true;
    try {
      const [id, , action, recipient, channel] = step;
      const org = id[0], role = id.slice(2), worker = this.workers[org];
      const advice = await worker.call('advise', { role, action, humanReview: this.config.humanReview.enabled });
      if (!this.config.modelRouting.enabled && advice.decision !== 'proceed') throw new Error('company_model_requested_hold');
      const route = await this.workflow.route(role, { stage: action, org, role, advice });
      // Optional routing can select only a role with the same authority for this step.
      if (route.role !== role) throw new Error('route_exceeds_step_authority');
      if (channel) {
        if (action === 'aggregate') await this.workflow.beforeDisclose('a');
        const packet = await worker.call('message', { role, recipient, channel, template: action, planHash: digest(this.plan) });
        this.receipts.push(this.relay.post(packet));
        await this.workers[recipient[0]].call('receive', { packet });
        if (action === 'accept') {
          for (const company of ['a', 'b']) {
            await this.workers[company].call('agree', { proposedPlan: this.plan });
            await this.workflow.agree(company, this.plan);
          }
        }
      } else if (action === 'compute-a') {
        await this.workflow.beforeCompute('a');
        this.aResult = await worker.call('compute', { proofsEnabled: this.proofsEnabled });
      } else if (action === 'compute-b') {
        await this.workflow.beforeCompute('b');
        this.bResult = await worker.call('combine', { aProof: this.aResult.proof, proofsEnabled: this.proofsEnabled });
      } else if (action === 'settle') {
        await this.workflow.beforeSettle();
        await this.settle(); this.workflow.settled();
      }
      await worker.call('admin');
      this.index++;
      this.persist();
      return this.status(agentId);
    } catch (error) {
      this.failed = true; this.failureReason = error.message; this.persist(); throw error;
    } finally { this.inflight = false; this.persist(); }
  }
  async settle() {
    console.error('Compiling verifier and settlement contract; proving worker count = 1.');
    const keys = await compileProofs({ proofsEnabled: this.proofsEnabled, contract: true });
    const proof = await JointProof.fromJSON(this.bResult.proof);
    let alteredProofRejected = null, wrongCaseRejected = null;
    if (this.proofsEnabled) {
      assert.equal(await verify(this.bResult.proof, keys.b.data), true);
      const altered = structuredClone(this.bResult.proof);
      altered.publicOutput[0] = Field(altered.publicOutput[0]).add(1).toString();
      alteredProofRejected = !(await verify(altered, keys.b.data));
      assert.equal(alteredProofRejected, true);
      const otherCase = structuredClone(this.bResult.proof);
      otherCase.publicInput[0] = Field(otherCase.publicInput[0]).add(1).toString();
      wrongCaseRejected = !(await verify(otherCase, keys.b.data));
      assert.equal(wrongCaseRejected, true);
    }
    let payer, payerKey, otherPayer, otherPayerKey;
    const endpoint = this.zeko ? (process.env.LOCAL_ZEKO_GRAPHQL ?? 'http://127.0.0.1:19230/graphql') : (process.env.MINA_GRAPHQL ?? 'http://127.0.0.1:18080/graphql');
    if (this.remote) {
      // Restrict the demo to a local test node; never inherit a public funded network.
      if (!['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('local_test_node_only');
      Mina.setActiveInstance(Mina.Network({ networkId: 'testnet', mina: endpoint }));
      if (this.zeko) {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ sequencerPk signatureKind }' }) });
        this.zekoIdentity = (await response.json()).data;
        assert.ok(this.zekoIdentity?.sequencerPk, 'endpoint must be a Zeko sequencer');
        assert.equal(this.zekoIdentity.signatureKind, 'testnet');
        const faucet = JSON.parse(readFileSync('.local/zeko/config/faucet.json'));
        payerKey = PrivateKey.fromBase58(faucet.privateKey); payer = payerKey.toPublicKey();
      } else {
        const account = await Lightnet.acquireKeyPair({ lightnetAccountManagerEndpoint: 'http://127.0.0.1:18181' });
        payer = account.publicKey; payerKey = account.privateKey;
      }
      await fetchAccount({ publicKey: payer });
    } else {
      const local = await Mina.LocalBlockchain({ proofsEnabled: this.proofsEnabled }); Mina.setActiveInstance(local);
      [payer, otherPayer] = local.testAccounts; payerKey = payer.key; otherPayerKey = otherPayer.key;
    }
    const contractKey = PrivateKey.random();
    const contract = new CollaborationRegistry(contractKey.toPublicKey());
    const caseRoot = Poseidon.hash(JointContext.toFields(this.context));
    const sender = { sender: payer, fee: '100000000' };
    const deploy = await Mina.transaction(sender, async () => {
      AccountUpdate.fundNewAccount(payer);
      await contract.deploy({ companyA: PublicKey.fromBase58(this.a.chainPublicKey), companyB: PublicKey.fromBase58(this.b.chainPublicKey), caseRoot });
    });
    await deploy.prove();
    const sentDeploy = await deploy.sign([payerKey, contractKey]).send();
    if (this.lightnet) { await sentDeploy.wait({ maxAttempts: 90, interval: 10000 }); await fetchAccount({ publicKey: contract.address }); await fetchAccount({ publicKey: payer }); }
    if (this.zeko) { await fetchAccount({ publicKey: contract.address }); await fetchAccount({ publicKey: payer }); }
    assert.equal(contract.completed.get().toString(), '0');
    const signed = [];
    for (const org of ['a', 'b']) signed.push(await this.workers[org].call('authorize', { address: contract.address.toBase58(), publicInput: JointContext.toJSON(this.context) }));
    const approvalA = Signature.fromBase58(signed[0].signature), approvalB = Signature.fromBase58(signed[1].signature);
    const forged = Signature.create(PrivateKey.random(), planAuthorization(contract.address, this.context));
    let wrongAuthorityRejected = false;
    try { await Mina.transaction(sender, async () => { await contract.settle(proof, forged, approvalB); }); }
    catch (error) { if (!/assert|equal/i.test(error.message)) throw error; wrongAuthorityRejected = true; }
    assert.equal(wrongAuthorityRejected, true);
    const build = account => Mina.transaction(account, async () => { await contract.settle(proof, approvalA, approvalB); });
    const tx = await build(sender); await tx.prove();
    let stale;
    if (!this.remote) { stale = await build(otherPayer); await stale.prove(); }
    let nodeRejectedAlteredTransaction = null, nodeRejectionReason = null;
    if (this.zeko) {
      const altered = JSON.parse(tx.toJSON());
      const update = altered.accountUpdates.find(u => u.body.publicKey === contract.address.toBase58() && u.authorization.proof);
      assert.ok(update, 'proved contract update required');
      update.body.update.appState[5] = Field(update.body.update.appState[5]).add(1).toString();
      nodeRejectedAlteredTransaction = false;
      try {
        // JSON round-tripping removes signing intent. Re-arm the fee-payer
        // signature so this test reaches proof verification, not signature rejection.
        const alteredTransaction = await Mina.Transaction.fromJSON(altered).setFee(UInt64.from(sender.fee));
        await alteredTransaction.sign([payerKey]).send();
      }
      catch (error) { if (!/invalid.*proof|proof.*invalid/i.test(error.message)) throw error; nodeRejectedAlteredTransaction = true; nodeRejectionReason = error.message; }
      assert.equal(nodeRejectedAlteredTransaction, true);
    }
    const submitted = await tx.sign([payerKey]).send();
    if (this.lightnet) { await submitted.wait({ maxAttempts: 90, interval: 10000 }); await fetchAccount({ publicKey: contract.address }); }
    if (this.zeko) { await fetchAccount({ publicKey: contract.address }); }
    assert.equal(contract.completed.get().toString(), '1');
    assert.equal(contract.resultRoot.get().toString(), this.bResult.outputCommitment);
    let replayRejected = false;
    try {
      if (stale) await stale.sign([otherPayerKey]).send();
      else { const replay = await build(sender); await replay.prove(); await replay.sign([payerKey]).send(); }
    } catch (error) { if (!/precondition|assert|equal|state/i.test(error.message)) throw error; replayRejected = true; }
    assert.equal(replayRejected, true);
    this.report = {
      synthetic: true, proofMode: this.proofsEnabled ? 'real-o1js' : 'simulation-no-cryptographic-proof',
      settlement: this.zeko ? 'native-Zeko-L2-ledger-acceptance' : this.lightnet ? 'local-Mina-node-inclusion' : 'in-process-local-ledger-acceptance',
      ...(this.zeko ? { endpoint, zekoSequencer: this.zekoIdentity, rollupCommitEnabled: false, sequencerBinary: "zeko-run-fake", rollupProver: "zeko-prover-fake", daQuorum: 0, nodeRejectedAlteredTransaction, nodeRejectionReason } : {}),
      zekoRollupSettlement: false, companies: 2, agents: 6, privateChannels: 3,
      workerIsolation: process.env.COMPANY_REMOTE_CONFIG ? 'ssh-independent-company-hosts' : process.env.WORKER_ISOLATION === 'docker' ? 'docker-no-network-company-mounts' : 'same-user-child-processes',
      nodeProofLevel: this.zeko ? 'native-Pickles-zkApp-verification; development-rollup-prover-fake; L1-commits-disabled' : this.lightnet ? 'none; application proofs independently verified' : null,
      applicationProofVerified: this.proofsEnabled, acceptedStateUpdate: true,
      completed: true, replayRejected, alteredProofRejected, wrongCaseRejected, wrongAuthorityRejected,
      replayRejectionLayer: this.remote ? 'client-state-precondition' : 'local-ledger-stale-state',
      resultCommitment: contract.resultRoot.get().toString(),
      contractAddress: contract.address.toBase58(), transactionHash: submitted.hash,
      humanReview: this.config.humanReview.enabled, modelRouting: this.config.modelRouting.enabled,
      identity: 'synthetic organization authorities; real capability and holder signatures',
      model: process.env.AGENT_INTELLIGENCE ?? 'off',
      identityHandshake: { scheme: this.handshake.presentations.a.payload.scheme, verifiedByBothCompanies: true, planBound: true, realZkIdentityProof: false, externalProviderVerified: this.handshake.presentations.a.payload.simulated === false, verificationLayer: 'off-chain-local-issuer-attestation; digest-bound-in-application-proof' },
      settlementDependency: this.zeko ? 'none; synthetic bootstrap metadata only' : null,
      elapsedSeconds: Math.round((Date.now() - this.started) / 1000),
    };
    if (this.proofsEnabled) {
      mkdirSync('.local/public-evidence', { recursive: true, mode: 0o700 });
      writeFileSync('.local/public-evidence/joint-proof.json', JSON.stringify(this.bResult.proof));
      writeFileSync('.local/public-evidence/verification-key.json', JSON.stringify(keys.b));
    }
  }
  persist() {
    mkdirSync('.local', { recursive: true, mode: 0o700 });
    writeFileSync('.local/relay-ciphertext.json', JSON.stringify(this.relay.messages, null, 2), { mode: 0o600 });
    writeFileSync('.local/admin-overview.json', JSON.stringify({ synthetic: true, caseId: this.caseId, completedSteps: this.index, failed: Boolean(this.failed), rooms: ['a-internal','b-internal','bilateral-planning'], deliveredEnvelopes: this.receipts.length, checkpoints: this.workflow.events, controls: this.controls.view('operator'), privateReports: 'Each company host: .local/company-a|b/admin-report.json', identityHandshake: this.identityStatus ?? 'pending' }, null, 2), { mode: 0o600 });
    writeFileSync('.local/checkpoints.json', JSON.stringify(this.workflow.events, null, 2), { mode: 0o600 });
    writeFileSync('.local/public-report.json', JSON.stringify(this.report ?? this.status(), null, 2));
  }
  close() { this.controls.close(); this.identityAdapter?.close(); for (const worker of Object.values(this.workers)) worker.close(); }
}
