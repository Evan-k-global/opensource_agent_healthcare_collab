import { readFileSync } from 'node:fs';
import { Mina, PrivateKey, AccountUpdate, Field, Bool, fetchAccount } from 'o1js';
const endpoint = process.env.LOCAL_ZEKO_GRAPHQL ?? 'http://127.0.0.1:19230/graphql';
if (!['127.0.0.1','localhost'].includes(new URL(endpoint).hostname)) throw new Error('local_node_required');
Mina.setActiveInstance(Mina.Network({ networkId:'testnet',mina:endpoint }));
const { privateKey }=JSON.parse(readFileSync('.local/zeko/config/faucet.json'));
const payer=PrivateKey.fromBase58(privateKey), target=PrivateKey.random();
await fetchAccount({ publicKey:payer.toPublicKey() });
const tx=await Mina.transaction({ sender:payer.toPublicKey(),fee:'100000000' }, async()=>{
  AccountUpdate.fundNewAccount(payer.toPublicKey());
  AccountUpdate.createSigned(target.toPublicKey()).body.update.appState[0]={isSome:Bool(true),value:Field(42)};
});
const sent=await tx.sign([payer,target]).send();
const { account }=await fetchAccount({publicKey:target.toPublicKey()});
if(account?.zkapp?.appState[0].toString()!=='42')throw new Error('state_mismatch');
console.log(JSON.stringify({ endpoint, signatureOnlySmoke:true, state:'42', address:target.toPublicKey().toBase58(), transactionHash:sent.hash },null,2));
