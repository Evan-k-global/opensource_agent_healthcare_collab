# Identity integration: simulation and Reclaim

Default runs use signed dummy attestations. They bind the case, nonce, audience, company holder key, agent registry, chain key and dummy dataset commitments. B also asserts dummy patient predicates. This is not zkTLS or KYC.

An optional integration uses the pinned `@reclaimprotocol/js-sdk` 5.8.3 verifier. It is implemented and tested for SDK loading, malformed-proof rejection, policy enforcement and session-binding failures. A live credential has **not** been verified: provider credentials and reviewed provider configurations are pending.

## Enable a provider when available

```sh
npm ci --ignore-scripts --prefix integrations/reclaim
node integrations/reclaim/test.mjs
```

Copy `config/reclaim.example.json` into a private local location, such as `.local/reclaim.json`. Configure a trusted provider ID and nonempty reviewed provider hashes for each company. Empty hashes deliberately fail closed. A requires an extracted `organizationId` matching the expected company. B requires that plus exactly `idPresent`, `ageEligible` and `conditionEligible`, all the string `true`. These are source-attested predicates; a provider that emits a patient name, full date of birth or extra attributes is rejected by this narrow adapter.

Set `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET` and `IDENTITY_PROVIDER_CONFIG` in your private environment using your existing secret-handling setup. Do not commit or paste secrets into chat. Then run the normal launcher. The coordinator starts a fresh provider request for each company. Its private request link appears in `.local/identity-requests/a.json` or `b.json`. Complete the provider flow before its five-minute challenge expires. No fixture fallback is used if external verification fails.

The adapter pins the provider's content policy, checks the SDK's verified result, requires an exact issued provider session ID, and binds the signed context to this case/nonce/audience/holder/claims digest. Evidence must be fresh. Each challenge is consumed once before asynchronous verification. Only the approved extracted attributes are accepted.

The [official SDK](https://github.com/reclaimprotocol/reclaim-js-sdk) documents proof verification and session context. Review provider configuration and trust assumptions before supplying real evidence. The integration does not create an account, choose an issuer on your behalf, or enroll actual patients.

## What becomes shared

Both companies receive a local verifier's signed attestation and a digest of verified evidence. The research plan binds that attestation digest. The o1js circuit does not itself verify the Reclaim proof. The local verifier remains a trusted component; replacing it with an independently verifiable identity circuit is additional work.

The provider attests only the configured organization ID and patient predicates. Corporate delegation, enrolled agent keys, and the association to dummy research inputs remain holder assertions bound to this session. A successful provider flow does not prove that a real patient corresponds to the dummy computation, establish consent, or authorize a clinical use.

The demo remains synthetic-only. Use a test issuer/provider whose extracted claims meet this contract; never place actual patient data in the fixtures. The dashboard and public receipt distinguish simulated identity from external evidence verified by the off-chain adapter.

## Licenses

The adapter code is Apache-2.0. The optional Reclaim SDK is a separate dependency under [its upstream license](https://github.com/reclaimprotocol/.github/blob/main/LICENSE); it is not relicensed by this package. Its source and transitive dependencies are not bundled in the public ZIP. The separately pinned integration manifest and lockfile are included.
