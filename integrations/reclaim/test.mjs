import assert from 'node:assert/strict';
import { verifyProof } from './sdk.mjs';
let rejected=false;
try {const result=await verifyProof({claimData:{},signatures:[]},{hashes:['0x'+'a'.repeat(64)]});rejected=result.isVerified===false;}catch{rejected=true;}
assert.equal(rejected,true);
console.log('Pinned Reclaim SDK loaded and rejected malformed evidence. No live credential was verified.');
