import { mkdirSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { PrivateKey, Mina, Types } from 'o1js';
import { fieldEncodings } from '../node_modules/o1js/dist/node/lib/util/base58.js';
import { Field as BigField } from '../node_modules/o1js/dist/node/mina-signer/src/field-bigint.js';
import { randomBytes } from 'node:crypto';
const dir = '.local/zeko';
for (const name of ['config', 'genesis', 'ledger']) mkdirSync(`${dir}/${name}`, { recursive: true, mode: 0o700 });
if (existsSync(`${dir}/config/faucet.json`)) { console.log('Existing localnet identity retained'); process.exit(0); }
let sequencer;
do { sequencer = PrivateKey.random(); } while (sequencer.toPublicKey().isOdd.toBoolean());
const faucet = PrivateKey.random();
const local = await Mina.LocalBlockchain({ proofsEnabled: false }); Mina.setActiveInstance(local);
const template = Types.Account.toJSON(Mina.getAccount(local.testAccounts[0]));
const snake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const enc = fieldEncodings(BigField);
const ledger = [sequencer, faucet].map((key, index) => {
  const pk = key.toPublicKey().toBase58();
  const permissions = Object.fromEntries(Object.entries(template.permissions).map(([k,v]) => [snake(k),
    k === 'setVerificationKey' ? [[v.auth], v.txnVersion] : [v]]));
  return [index, { public_key: pk, token_id: template.tokenId, token_symbol: '', balance: '1000000000000000', nonce: '0',
    receipt_chain_hash: enc.ReceiptChainHash.toBase58(BigInt(template.receiptChainHash)), delegate: pk,
    voting_for: enc.StateHash.toBase58(0n), timing: ['Untimed'], permissions, zkapp: null }];
});
const put = (path, value) => writeFileSync(`${dir}/${path}`, value, { mode: 0o600 });
put('genesis/ledger.json', JSON.stringify(ledger));
put('config/sequencer.key', sequencer.toBase58());
put('config/sequencer.pub', sequencer.toPublicKey().toBase58());
put('config/signer.token', randomBytes(32).toString('hex'));
put('config/faucet.json', JSON.stringify({ synthetic: true, privateKey: faucet.toBase58(), publicKey: faucet.toPublicKey().toBase58(), endpoint: 'http://127.0.0.1:19230/graphql', networkId: 'testnet' }));
for (const name of ['circuits.json', 'deploy.json']) if (existsSync(`${dir}/config/${name}`)) chmodSync(`${dir}/config/${name}`, 0o600);
console.log('Created synthetic localnet identities and native ledger import');
