import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verify, Mina, fetchAccount, PublicKey, Poseidon, Field } from 'o1js';
import { compileProofs } from './proofs.mjs';

const directory = resolve(process.argv[2] ?? 'evidence/in-process');
const report = JSON.parse(readFileSync(`${directory}/report.json`));
assert.equal(report.completed, true, 'run did not complete');
assert.equal(report.proofMode, 'real-o1js', 'simulation is not proof evidence');
const proof = JSON.parse(readFileSync(`${directory}/proof/joint-proof.json`));
const savedKey = JSON.parse(readFileSync(`${directory}/proof/verification-key.json`));
// Derive the verification key from this package's circuit; do not trust a
// prover-supplied key alone. This is a public-input-only verification process.
const keys = await compileProofs({ proofsEnabled: true });
assert.equal(keys.b.data, savedKey.data, 'evidence key differs from the current circuit');
assert.equal(await verify(proof, keys.b.data), true);
assert.equal(proof.publicOutput[0], report.resultCommitment);
let nodeStateMatches = null;
if (process.argv.includes('--node')) {
  const endpoint = process.env.LOCAL_ZEKO_GRAPHQL ?? report.endpoint ?? process.env.MINA_GRAPHQL ?? 'http://127.0.0.1:18080/graphql';
  if (!['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('local_node_required');
  Mina.setActiveInstance(Mina.Network({ networkId: 'testnet', mina: endpoint }));
  const { account, error } = await fetchAccount({ publicKey: PublicKey.fromBase58(report.contractAddress) });
  if (error) throw new Error(error.statusText);
  const state = account.zkapp.appState.map(value => value.toString());
  assert.equal(state[4], Poseidon.hash(proof.publicInput.map(value => Field(value))).toString());
  assert.equal(state[5], report.resultCommitment);
  assert.equal(state[6], '1');
  nodeStateMatches = true;
}
console.log(JSON.stringify({ circuitKeyMatches: true, proofVerified: true, outputMatches: true, nodeStateMatches }, null, 2));
