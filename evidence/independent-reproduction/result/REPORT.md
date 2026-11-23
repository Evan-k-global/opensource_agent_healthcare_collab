# Independent reproduction — passed

The documented Node/Python tests, fresh native Zeko bootstrap, distributed mock workflow, and distributed actual-Gemma workflow reproduced successfully without changes to executable source. Both saved application proofs were then verified in separate processes against verification keys derived from the packaged circuit, and their case/result/completion state matched the running Zeko ledger.

## Who did what
A fresh independent agent selected the commands from the extracted README/TESTED specification and relevant Zeko skill, inspected the package and its own fresh results, and determined this verdict. The agent did not inspect the original implementation checkout or historical run-evidence files. Its sandbox initially denied localhost listeners, Docker socket access, and Python dependency downloads. After the user granted runtime permissions to the parent agent, the parent mechanically executed the independently selected commands and returned fresh logs. The independent agent retained test selection and interpretation. This is agent-directed reproduction on the SAME PHYSICAL APPLE SILICON MAC, not a new human reviewer, separate machine, or independent infrastructure provider.

## Tested artifact
Candidate: reproduction-candidate-v03-final.zip
SHA256: 6a1cac3277c19263a8b0c9b01d85b08c185ada26af6693330ded368a0c977dc1
The archive hash identifies the tested candidate BEFORE the final documentation/evidence refresh. implementation-sha256.json contains hashes of 107 packaged implementation/configuration/dependency/vendor files, excluding README.md, TESTED.md, REVIEW.md, historical evidence, and generated runtime files. All 107 files matched the candidate byte-for-byte after testing. An earlier integrity check also compared all 110 non-evidence package files, including those three documents, with no differences.

## Environment and freshness
Node 20.20.0; own Python 3.12.16 virtual environment; Google Antigravity SDK 0.1.10; Ollama 0.40.17. Node dependencies were installed into the fresh extraction from an existing dependency cache (109 packages). Python dependencies were installed into the agent's own virtual environment. Docker image/build caches and the existing Ollama server/model were environment resources; no primary ledger or company state was reused.

The new Zeko project was independent-repro-zeko, endpoint http://127.0.0.1:19231/graphql, with fresh identities, ledger, database, queue, and DA history. The new company project was independent-repro-hosts, with fresh per-company state and proving-cache volumes. Mock and Gemma runs used this same newly bootstrapped independent network but different sessions, cases, contracts, commitments, and transaction hashes. The original Zeko project on port 19230 was not changed.

Two Linux company containers each ran their own Antigravity process and three agent conversations over pinned SSH. They shared one physical host, Docker engine, and local Ollama inference endpoint. This does not establish two independent physical companies, independently hosted inference, or hostile-host security.

## Results
- Node suite: 14 passed, zero failed.
- Python status-retry regressions: 3 passed, zero failed.
- Fresh Zeko startup: native checkpoint recovery initialized genesis DA history; Zeko-specific sequencerPk and signatureKind=testnet confirmed at port 19231.
- Signature-only smoke: native ledger state read back as 42.
- Distributed mock: six SDK agent conversations, five completed turns per company, own-agent ownership, mock advisories, company data/credential/room boundary assertions, real A and recursive B application proofs, native rejection of an altered transaction proof, and accepted valid state. Backend report elapsed 218 seconds; final company harness 217 seconds.
- Actual Gemma: gemma4:e2b-it-q4_K_M was independently observed in Ollama's installed-model metadata with tools capability. Digest b37049369adfe3d2b653af0ab301a062ca5cbe96ace6aa0d3f2559ee9b563fc2. Both company results name that installed model for all three agents, report five completed turns and gemma advisory mode, and pass private-room assertions. Native proof rejection and valid state acceptance passed. Backend report elapsed 424 seconds; final company harness 446 seconds.
- Separate verification for EACH run: circuitKeyMatches=true, proofVerified=true, outputMatches=true, nodeStateMatches=true.
- No executable source changes were required. After verification, both independent projects were stopped successfully. All two company hosts and seven Zeko services were confirmed exited, with volumes retained. Five Zeko services required termination after the Compose stop timeout (exit 137); this cleanup detail does not affect the proof/state checks completed beforehand. The shared Ollama service and original projects were left untouched.

## Environment failures, not software failures
Initial subagent commands failed due to sandbox restrictions on listeners, Docker, and DNS. The host build also initially failed because Docker buildx could not write its default configuration activity directory. Retrying with a writable runtime DOCKER_CONFIG directory and explicit OrbStack DOCKER_HOST resolved that environment issue. The successful full tests were then executed through the user-approved parent runtime. These initial errors are not counted as package test failures.

## Documentation and dependencies
The earlier candidate mixed current v0.3 Gemma claims with statements that Gemma remained untested. The final candidate distinguishes historical and current results, resolving that contradiction. Its interim TESTED.md statement that independent reproduction remained permission-blocked must be refreshed with this final result.

The documented requirements.txt pins the SDK, while the reference requirements-lock.txt records historical resolved versions. The fresh documented install selected four newer transitive versions: certifi 2026.11.20 (reference 2026.10.23), charset-normalizer 3.5.3 (reference 3.5.2), google-auth 2.63.1 (reference 2.62.2), and sse-starlette 3.7.1 (reference 3.7.0). All tests and workflows passed with those versions. python-dependencies.txt records the exact fresh environment.

## What this result does not claim
All records are synthetic. Identity is simulated signed attestation, not real zkTLS/KYC or verified patient attributes. Application proofs are real o1js proofs verified by the native node; background rollup proofs use the development fake prover, DA quorum is zero, L1 commits are disabled, and no bridge/L1 finality or production rollup is validated. Repeat settlement rejection is a client state-precondition check, not a second rejected on-chain submission. Human review and dynamic model routing were off. The workflow, permitted tools, and arithmetic are bounded; no autonomous research quality or proof of model inference is established. Linux-host and Windows/WSL portability were not tested.

## Public evidence
mock/ and gemma/ contain only fresh public reports, harness-validation summaries, public proofs/verification keys, and separate-verification results. Other files contain test summaries, dependency versions, source hashes, and reproduction commands. Private keys, bearer tokens, access files, SDK conversations, private transcripts, raw patient/research data, and aggregate/result commitment openings are excluded. Public commitments and case identifiers still reveal case-level linkage and activity.
