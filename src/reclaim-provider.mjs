import { mkdirSync, writeFileSync } from 'node:fs';
import { digest } from './workshop.mjs';

export function validateProviderPolicy(policy) {
  if (policy?.provider !== 'reclaim' || !policy.organizations) throw new Error('invalid_identity_provider_policy');
  for (const org of ['a','b']) {
    const p=policy.organizations[org];
    if (!p?.providerId || !Array.isArray(p.hashes) || !p.hashes.length || !p.hashes.every(h=>/^0x[a-fA-F0-9]{64}$/.test(h))) throw new Error('pinned_provider_hashes_required');
    if (!p.expectedClaims || typeof p.expectedClaims.organizationId !== 'string' || !p.expectedClaims.organizationId) throw new Error('organization_claim_policy_required');
    if (org==='b' && !['idPresent','ageEligible','conditionEligible'].every(k=>p.expectedClaims[k]==='true')) throw new Error('patient_predicate_policy_required');
    if (Object.keys(p.expectedClaims).some(k=>!['organizationId','idPresent','ageEligible','conditionEligible'].includes(k))) throw new Error('unapproved_identity_attribute');
  }
  return policy;
}
export async function verifyReclaimEvidence({ proofs, challenge, claims, expectedSessionId, policy, sdkVerify, now=Date.now() }) {
  validateProviderPolicy(policy);
  const p=policy.organizations[challenge.org];
  if (!Array.isArray(proofs) || proofs.length!==1 || !expectedSessionId) throw new Error('one_session_bound_proof_required');
  // The pinned SDK checks registered witness signatures and pinned provider content.
  const result=await sdkVerify(proofs,{hashes:p.hashes});
  if (result?.isVerified!==true || result.data?.length!==1) throw new Error('reclaim_proof_invalid');
  const context=result.data[0].context;
  for (const [key,value] of Object.entries({reclaimSessionId:expectedSessionId,caseId:challenge.caseId,org:challenge.org,audience:challenge.audience,nonce:challenge.nonce,holderKeyHash:challenge.holderKeyHash,claimsHash:digest(claims)})) {
    if (context?.[key]!==value) throw new Error(`reclaim_binding_${key}`);
  }
  const timestamp=proofs[0].claimData?.timestampS*1000;
  if (!Number.isFinite(timestamp) || timestamp>now+5000 || now-timestamp>300000 || challenge.expiresAt<=now) throw new Error('reclaim_proof_stale');
  const extracted=result.data[0].extractedParameters;
  if (!extracted || Object.keys(extracted).length!==Object.keys(p.expectedClaims).length) throw new Error('identity_attribute_disclosure_mismatch');
  for(const [key,value] of Object.entries(p.expectedClaims)) if(extracted[key]!==value) throw new Error(`identity_attribute_${key}_mismatch`);
  return { provider:'reclaim', verified:true, proofDigest:digest(proofs), policyDigest:digest(p), verifiedFields:Object.keys(p.expectedClaims),
    verificationLayer:'off-chain-SDK-and-local-verifier-attestation', sessionBound:true, dataAssociation:'holder-asserted; dummy computation inputs are not source-attested' };
}
export function waitForProviderSession(request, verificationConfig, expiresAt, active=new Set()) {
  return new Promise((resolve,reject)=>{
    let finished=false;
    const stop=()=>{Promise.resolve(request.cancelSession()).catch(()=>{});};
    const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);active.delete(cancel);stop();if(error)reject(error);else resolve(Array.isArray(value)?value:[value]);};
    const cancel=()=>finish(new Error('identity_provider_closed'));
    const timer=setTimeout(()=>finish(new Error('identity_provider_deadline')),Math.max(1,expiresAt-Date.now()));
    active.add(cancel);
    Promise.resolve().then(async()=>{if(finished)return;await request.startSession({verificationConfig,onSuccess:value=>finish(null,value),onError:()=>finish(new Error('identity_provider_session_failed'))});if(finished)stop();}).catch(()=>finish(new Error('identity_provider_session_failed')));
  });
}
export async function createReclaimProvider(policy) {
  validateProviderPolicy(policy);
  if (!process.env.RECLAIM_APP_ID || !process.env.RECLAIM_APP_SECRET) throw new Error('RECLAIM_APP_ID_and_RECLAIM_APP_SECRET_required');
  const sdk=await import('../integrations/reclaim/sdk.mjs');
  const active=new Set();
  return {
    async obtain({challenge,claims}) {
      const p=policy.organizations[challenge.org];
      const request=await sdk.ReclaimProofRequest.init(process.env.RECLAIM_APP_ID,process.env.RECLAIM_APP_SECRET,p.providerId);
      request.setJsonContext({caseId:challenge.caseId,org:challenge.org,audience:challenge.audience,nonce:challenge.nonce,holderKeyHash:challenge.holderKeyHash,claimsHash:digest(claims)});
      const expectedSessionId=request.getSessionId();
      const url=await request.getRequestUrl();
      mkdirSync('.local/identity-requests',{recursive:true,mode:0o700});
      writeFileSync(`.local/identity-requests/${challenge.org}.json`,JSON.stringify({caseId:challenge.caseId,org:challenge.org,requestUrl:url,expiresAt:challenge.expiresAt},null,2),{mode:0o600});
      console.error(`Identity evidence needed for company ${challenge.org.toUpperCase()}; private request link in .local/identity-requests/${challenge.org}.json`);
      const proofs=await waitForProviderSession(request,{hashes:p.hashes},challenge.expiresAt,active);
      return verifyReclaimEvidence({proofs,challenge,claims,expectedSessionId,policy,sdkVerify:sdk.verifyProof});
    },
    close(){for(const cancel of active)cancel();active.clear();}
  };
}
