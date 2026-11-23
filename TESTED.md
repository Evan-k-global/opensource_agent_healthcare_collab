# Validation — updated 23 November 2026

## Current v0.4 validation

Version 0.4 adds three scoped browser dashboards, a one-command launcher/preflight/reset flow, interactive company approvals, bounded model routing, optional Reclaim verification and separate-host handoff tooling. Live Reclaim credentials, physical company hosts and an outside-human reviewer remain pending by explicit project scope.

- 23 Node tests and seven Python regressions pass (status retries and bounded corrective model prompts). New tests cover cross-company/coordinator approval denial, held/resolved/stale requests, immediate bilateral rejection, review expiry, asynchronous turn submission without resubmission, case replacement, dashboard authorization and Reclaim policy/session rejection.
- A full isolated-company browser test passed with proof simulation, review and routing enabled. Browser Hold and Approve worked, each company saw only its own internal room and bilateral room, and the coordinator view had no room/advice payload or approval buttons. Mobile layout at 390 px had no horizontal overflow. Approvals were simulated by browser/HTTP test automation, not attributed to a human. Evidence: `evidence/v4-dashboard-controls`.
- The one-command mock-model run with real application proofs passed on native Zeko in 113 seconds. A separate process confirmed expected verification key, proof, output and persisted node state. Evidence: `evidence/v4-mock-zeko`.
- The optional pinned Reclaim SDK 5.8.3 loaded and rejected malformed evidence. Policy tests use injected verifier results to exercise binding, freshness, exact-attribute and cancellation checks. No live Reclaim credential or provider session has been verified.
- The repository skill passed the skill validator; local onboarding links and Python syntax passed. Company bundle export checked that peer fixtures and private runtime directories were excluded. A fresh agent reviewed setup and lifecycle behavior; its reported approval-cancellation, SDK-poll cleanup and Python dependency-lock issues were fixed and regression-tested.

The actual Gemma run with model routing enabled passed: state acceptance in 394 seconds, final harness completion in 414 seconds, five turns per company, and no corrective prompts needed. Evidence is in `evidence/v4-gemma-zeko`. An earlier run stopped safely on a stale model answer; the explicit live-state prompt and bounded-correction guard were added and tested, with the failure retained in `evidence/v4-dashboard-controls/run-notes.json`. A fresh unfamiliar agent also completed the documented mock/proof-disabled onboarding path from a new archive extraction, with fresh company volumes, independent dependency installation, 23 Node tests and seven Python tests. It selected and assessed the checks; the parent executed runtime commands through the approved runtime because the agent sandbox denied Docker/network/listeners. This is same-Mac agent-directed onboarding, not outside-human or physical-host validation. See `evidence/v4-onboarding/REPORT.md`. Both real-proof runs separately passed all four proof/key/output/node-state verification checks. Earlier versions remain historical evidence; their manifests do not describe the changed v0.4 source.

## Historical v0.3 validation

Version 0.3 adds independent per-company Antigravity processes and a reproducible SSH/container-host profile. These are two isolated Linux containers on the same Mac, with one shared local inference server; they are not two physical machines.

- All 14 Node unit/integration tests pass. Three Python regression tests cover temporary status-poll timeouts during proof compilation, immediate authentication failure, and a bounded disconnect deadline.
- The two-host mock workflow completed all ten steps. Each company ran its own three agent conversations, completed five turns, and retained only its own data, credentials and private reports.
- Gemma 4 E2B Q4_K_M is installed locally through Ollama 0.40.17. A real native tool call and a real bounded-JSON advisory response passed on CPU after Metal failed in the execution sandbox.
- The complete real-Gemma workflow passed: six agent conversations in two independent company harnesses, five turns and five real advisory responses per company, encrypted room/aggregate exchange, real A and recursive B proofs, and native Zeko state acceptance. Zeko rejected the altered transaction proof before accepting the valid update. State acceptance took 370 seconds; the final harness completed in 390 seconds. Evidence: `evidence/v3-gemma-independent-harnesses`.
- A fresh unfamiliar agent reproduced the final candidate on 23 November: all 14 Node and three Python tests, fresh Zeko bootstrap and state-42 smoke, two isolated company hosts, the mock-model workflow with real proofs, and the actual Gemma workflow. Mock state acceptance took 218 seconds; real-Gemma state acceptance took 424 seconds and the final harness completed in 446 seconds. Separate verifier processes confirmed the expected circuit key, proof, output and native node state for both runs.
- The agent selected commands and independently assessed outputs from its own extracted package, fresh project volumes and ledger. Its sandbox could not access the required runtime, so the parent executed those commands through the explicitly approved runtime. This is independent-agent-directed reproduction on the same physical Mac and shared Ollama server, not another human's or physical machine's validation. See `evidence/independent-reproduction/result/REPORT.md` for commands, dependency versions, environment adjustments and the tested implementation hash manifest. The earlier blocked preparation record is retained as history.

The runnable commands are in the README section “Reproduce two independent company harnesses locally (v0.3).” Earlier evidence below is retained as historical validation, not a statement that the new features are absent.

## Historical v0.2 checks

Tested on an Apple Silicon Mac with OrbStack/Docker, Node, o1js 2.13.0, Python 3.12.16, and Google Antigravity SDK 0.1.10. Gemma weights were not installed. All patient/research records are dummy data.

| Check | Observed result |
| --- | --- |
| `npm test` | 14 passed. Encryption, private-channel boundaries, holder signatures, replay/budgets, case/capability substitution, plan agreement, human-review/routing hooks, fixed circuit, MCP authorization, identity HTTP exchange and worker bindings, model-advice constraints, and SSH argument validation. |
| `python antigravity/run_fixture.py --zeko` | Real SDK completed six conversations and ten workflow steps through 20 MCP tool calls. The bundled scripted endpoint also handled ten company-local advisory calls. Real A and recursive B application proofs were generated, verified, and accepted by the native Zeko ledger. |
| Native proof enforcement | Zeko rejected a freshly signed transaction containing an altered proved update with `Invalid proof`, then accepted the valid transaction. Wrong output, case, authority, and repeat settlement checks also passed. Repeat settlement is rejected by the client's state-precondition check, not by a second submitted network transaction. |
| Simulated identity | Both workers performed the authenticated HTTP challenge/presentation handshake and verified it before agreement. Its digest is bound into the proof's plan commitment. Dummy patient ID-presence, adult-age, and condition predicates were used. No real credential or zkTLS proof was verified. |
| Administrator reports | Fixture asserts each company sees its own internal room and bilateral summaries, five private advice entries, and simulated identity status. The coordinator receives progress metadata. Raw input fields and aggregate openings are excluded from the administrator summaries. |
| Standalone Zeko startup | A fresh Compose project with fresh identities, ledger, PostgreSQL, queue and DA storage bootstrapped while the Mina container was stopped. Native checkpoint recovery created DA history. Signature-only zkApp state read back `42`. |
| Zeko restart / independent verification | Restarted the primary sequencer with Mina stopped. A separate process recompiled the expected circuit verification key, verified the saved real proof, and matched the restored case/result/completion fields on-chain. |
| No live L1 dependency | Default Compose uses an internal synthetic metadata service and disables commits. No Mina/Ethereum node or host-network mapping is needed. |
| Company-local intelligence API | HTTP fixture tested `proceed`, `hold`, unauthorized role rejection, and rejection of nonlocal endpoints. Advice cannot change permissions, routing, or the computation. Actual Gemma quality/tool behavior remains untested. |
| Public source archive | Extracted into a new directory, installed 109 dependency packages from the existing npm cache with `npm ci --ignore-scripts --offline`, and passed all 14 tests. |
| SSH transport | Strict known-host checking, safe command arguments and company-local model URLs tested. No two-physical-machine run completed. |

Historical v0.2 public reports, real proof, verification key and harness results are in `evidence/v2-standalone-harness`. Fresh-bootstrap evidence is in `evidence/v2-standalone-localnet`. No private transcript, identity bearer token, patient ID, result opening, or private key is included there.

## Reproduce

From an extracted source package with Node 20.19+, Docker Compose, and Python 3.10+ available:

```sh
npm ci --ignore-scripts
npm test
npm run zeko:up
python3 -m venv .venv
.venv/bin/pip install -r antigravity/requirements.txt
.venv/bin/python antigravity/run_fixture.py --zeko
npm run admin:report -- a
npm run admin:report -- b
```

This uses the actual SDK with the bundled mock endpoint. It does not need Gemma, Slack, any cloud-model account, real patient data, a Mina node, or Ethereum RPC. Initial dependency/image downloads need internet access. First proof compilation can take several minutes. Use only one backend session per package directory; the runner starts/stops its own backend and fixture. The Docker Zeko stack remains running afterward.

To verify the shipped proof independently of either company's private inputs:

```sh
npm run verify:evidence -- evidence/v2-standalone-harness
```

`verify:evidence` derives the expected verification key from the circuit source rather than trusting the saved key alone. Add `--node` only when the corresponding recorded contract still exists in the persisted local ledger. A fresh developer's ledger will have new addresses and transaction hashes; run the demo to generate their own evidence. To verify that run, save `.local/public-report.json` as `<directory>/report.json` and `.local/public-evidence` as `<directory>/proof`, then pass that directory to `verify:evidence -- <directory> --node`.

The README includes real-Gemma setup, identity endpoint contracts, separate-host configuration, local administrator commands, and the exact native-Zeko development limitations.

## Historical v0.1 checks retained

| Check | Observed result at that revision |
| --- | --- |
| Native-process real-proof workflow | Passed in 124 seconds with a warm cache on an in-process ledger. |
| Docker-isolated workers | Real-proof workflow passed in 225 seconds. Separate mounts, read-only roots, disabled network, and dropped Linux capabilities inspected. Follow-up shutdown check left no worker containers. |
| Native Zeko | Real-proof run passed in 98 seconds, with node rejection of an altered proof and acceptance of the valid update. Restart and fresh-process proof/state verification passed. |
| Original clean Zeko bootstrap | State `42` and signed DA receipts verified. That older configuration reused Mina Lightnet for startup reads; v0.2 removes that dependency. |
| Mina Lightnet | Real application proofs verified and contract update included in 262 seconds. Lightnet used nonproduction proof-level-none mode; this does not establish native protocol proof enforcement. |
| Original Antigravity fixture | Six conversations / ten steps with simulated proofs. Superseded by the real-proof v0.2 fixture above. |
| Dependency audit | npm reported zero known vulnerabilities at the original validation time. This is not a continuing vulnerability guarantee. |

Historical reports are retained in their original evidence directories. The Docker-isolated workflow was tested before the v0.2 additions; the historical v0.2 end-to-end harness uses separate same-user company processes. Rebuild the worker image before using the changed source in Docker mode.

## Remaining limits

- Historical mock evidence tests orchestration, not model intelligence. Current Gemma validation passed as reported above; this is tool-use and bounded-advice validation, not autonomous research quality or proof of model inference. Workflow order, dialogue templates and arithmetic remain fixed. Optional human checkpoints and bounded proceed/review routing are implemented and tested, but off by default. Automated approval tests are labeled simulated.
- The native image is pinned to the published v1.0.5 `zeko-run-fake` / `zeko-prover-fake` development pair. Real application proof verification is retained, while background rollup proofs are simulated. DA is one local node with quorum zero; there is no bridge, batch settlement, L1 finality or production rollup validation.
- The synthetic metadata adapter replaces the legacy binary's bootstrap reads. It does not certify any external chain state. Current Zeko Ethereum settlement is a separate stack, not something exercised by this demo.
- Signed dummy identity attestations do not establish real identity, patient attributes, consent, or legal compliance. Their signatures are checked off-chain; the circuit binds their agreed digest rather than proving their validity. Issuer trust is supplied by the demo coordinator.
- SSH workers support separate company hosts, but physical-host interoperability, production enrollment/key custody, and revocation remain unvalidated. Independent company harnesses are now implemented and exercised in local containers. Same-user processes do not form a hostile-tenant security boundary.
- Linux no longer needs `host.docker.internal` for this stack, but a clean Linux-host run has not been performed. Windows/WSL is unvalidated.
- Magic City browsing/ordering and payments remain disabled. Slack is unnecessary for this envelope-based demo. A real joint secret computation beyond A's approved aggregate may require MPC in addition to ZK.

The original local repositories were left unchanged. The inventory covered 67 checkouts; the review focused on relevant components rather than auditing every line. Authored source and documentation are Apache-2.0, with third-party licenses and provenance retained.

## GitHub publication

The GitHub repository retains its existing canonical Apache-2.0 LICENSE text. Its LICENSE checksum therefore differs from the reproduction candidate; executable source is unchanged. Historical candidate manifests remain unmodified records of what was tested. Third-party license files and notices remain under vendor/.
