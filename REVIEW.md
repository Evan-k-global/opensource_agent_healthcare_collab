# Local Codex review — 20 November 2026

The project inventory found 67 Git checkouts through directory depth three. Dependencies, vendored repositories, secrets, and generated builds were excluded from the inventory. The source review focused on the relevant protocols and their concrete proof/integration boundaries; it was not a line-by-line audit of every project or historical worktree.

## Reuse map

| Local component | Reuse | Important boundary |
| --- | --- | --- |
| `aaif` (`6c48fc1`) | MCP/A2A integration patterns, identity-to-mission-to-action path, negative tests | Its reservation proof demonstrates arithmetic/commitment binding; accepted state is a local single writer, not deployed core consensus. |
| `zeko-apache-prs/santa_clawz-private_agents` (`960b0e7`) | Workshop channels, private swarm envelopes, receipts, agent roles | Local key custody and content policy are the customer's responsibility. A general public-envelope projection is not appropriate for a private healthcare transcript. |
| `clawz` | Two-local-agents example and newer uncommitted coordination work | The working checkout is dirty; it was left unchanged. Review and selectively port changes rather than copying its state wholesale. |
| `zeko-apache-prs/agent-mission-bound-auth` (`83d2b53`) | Signed capabilities, holder events, scopes, approval/revocation/nullifier patterns | Existing mission compliance proves policy and domain-verifier attestation. A domain-verifier signature is not the healthcare computation itself. |
| `zeko-apache-prs/magic-city-agentic-internet` (`3a5d3d0`) | Browser workflow boundaries, approved actions and final-submit milestones | Keep raw patient/research data out of web queries. Browsing and ordering are optional, off in this package. |
| `zeko-apache-prs/x402-zeko` (`6f1f5b6`) | Optional payment intent and reserve/release linkage | Payment verification does not establish research correctness. No payment is required by the first demo. |
| `zk-verify-poc` (`b3aef68`) | TLSNotary/ECDSA and eligibility-program scaffolding | The reviewed circuit verifies a signature over a session header, but does not itself constrain the supplied salary/status/body hash to authenticated transcript bytes. Do not reuse it as a complete patient-identity proof without closing and testing that binding. |
| `research-market-hackathon` | Research-scope and receipt handoff concepts | `ResearchProofRegistry` largely checks nonzero digests and records roots; its private witness fields are not used to recompute the advertised research result or authorization. It is not a proved research computation. |
| `zeko-ai-runtime` | Local/encrypted input and output patterns, prover packaging | The documented native-agent proof establishes knowledge of committed input/output/policy fields, not correctness of arbitrary LLM inference. |
| `ethereum-settlement` | Local sequencer/DA, bridge and settlement test harnesses | Some Anvil paths deliberately use a mock SP1 verifier. A successful mock round trip is not a real L1 proof-settlement claim. |
| `zeko-license-rollout/zeko`, `util`, local explorers | Core source and operator packaging references | Historical revisions differ. Pin a matching sequencer/gateway/circuit generation instead of combining arbitrary latest folders. |

The October Apache exports are preferable starting snapshots to older folders still carrying previous license text. The exported code's licenses and exact provenance are retained in this demo. No existing checkout was modified.

## The swarm / Slack work that was found

The relevant source locations, relative to the SantaClawz repository, are:

- `docs/start-here/team-org-coordination-bridge.md`
- `docs/protocol/team-coordination-bridge-v0.1.md`, especially **Private Workshop Channels** and **Private Envelope Transport**
- `docs/protocol/interagent-swarm-protocol.md`
- `docs/start-here/workshop-admin-agent-runbook.md`
- `packages/agent-sdk/src/coordination.ts`
- `packages/protocol/src/agent-communication/envelope.ts`
- `examples/coordination/two-local-agents/`
- `examples/workspace-connectors/slack-export-wrapper/`

The Workshop supports declared channels, agent/role membership, scoped access tokens, and encrypted directed envelopes. Its public projection is proof-only. The Slack-export wrapper reads a local export and publishes only permitted metadata/commitments; it is distinct from live Slack integration. This demo does not create or send anything to a Slack workspace.

## Local chain choices

1. **o1js local ledger:** proven feasible in this session. A separate preliminary spike generated a real proof, changed state, read it back, and rejected an altered output and stale-state transaction in 38 seconds. It is an in-process ledger, not a live Zeko network.
2. **Mina Lightnet:** persistent GraphQL process for two clients, Docker/OrbStack packaging, funded test accounts. This package includes a local-node adapter and Compose configuration. Mina-compatible zkApp acceptance is useful without operating an entire rollup. See [official Lightnet documentation](https://docs.minaprotocol.com/zkapps/writing-a-zkapp/introduction-to-zkapps/testing-zkapps-lightnet).
3. **Native Zeko execution localnet:** the package includes the published v1.0.5 native sequencer, persistent ledger, PostgreSQL, RabbitMQ, signer, DA node, and development rollup prover. It runs independently of the hosted Zeko network. Real zkApp proofs are checked by the native admission verifier. The lightweight profile uses `zeko-prover-fake` for background rollup jobs, DA quorum zero, and disabled commits. Version 0.2 replaces the old Mina startup dependency with a synthetic read-only bootstrap-metadata fixture. It requires neither Mina nor Ethereum and performs no L1 settlement. See README for exact commands.
4. **Full Zeko rollup:** requires real rollup circuit keys/proofs, canonical genesis, DA, and an actual L1 verification contract. The official [independent-rollup guide](https://docs.zeko.io/operators/guides/launch-sepolia-rollup) specifies Linux x86_64 and at least 64 GB RAM for its complete stack. The reviewed repository restricts heavy proving on the shared 16 GB development Mac. Replace the development substitutions together; enabling commits alone cannot turn this profile into a settling rollup.

Keep three claims separate: application proof verified; zkApp state accepted by a local ledger/node; rollup state settled to L1. The demo report does so explicitly.

## Identity, privacy, and clinical boundaries

- Patient identity stays at B. A should receive a case-scoped authorization/consent claim, not the patient identifier. A real deployment needs an issuer trust policy, freshness, subject/session binding, and revocation. zkTLS can attest a source interaction; it does not establish legal consent or an agent's corporate delegation by itself.
- Organization identity and agent delegation should use enterprise-issued signed credentials plus holder-bound missions. The demo uses fresh synthetic organization authorities and real signatures, clearly labeled.
- Salt low-entropy patient, diagnosis, and result commitments. Do not put unsalted patient IDs or free-text diagnosis hypotheses on-chain.
- Fix the query/circuit and release policy before execution. Limit repeated queries; many individually small outputs can reconstruct sensitive datasets. The first demo permits one case execution and one defined aggregate disclosure.
- New research circuits must prove the selected computation. Neither an anchored output hash nor a signature saying a model ran is a proof that its answer is medically valid.
- A final commitment does not prove that every off-chain message was truthful, that every event was captured, or that no unauthorized side channel exists. Enforce filesystem, network, and tool boundaries outside the proof as well.
- Human-review hooks are off by default. Version 0.4 can enable company-scoped interactive checkpoints; automated test decisions are labeled simulated, not attributed to a human.

## Next milestones

The first runnable slice is internal discussion → private bilateral agreement → A proof → encrypted approved aggregate → B recursive proof → shared application-state acceptance. It passed on the local ledger, with Docker-isolated company workers, on a pinned Mina Lightnet node, and on the native Zeko development localnet. Zeko rejected an altered proof at the node and accepted the valid result update. The real Antigravity SDK also completed a ten-step transport-fixture run. See [TESTED.md](TESTED.md) for the evidence and limits.

Version 0.2 adds a bundled Antigravity mock with real proof execution through MCP and native Zeko acceptance, company-local model advice, per-company room/admin reports, a simulated identity HTTP handshake bound into the proof plan, and an SSH worker transport. No Slack service is required. The synthetic identity adapter does not verify real credentials, and the SSH path has not been tested on two physical machines.

Version 0.3 completed the real Gemma 4 E2B workflow through two independent Antigravity harnesses in isolated Linux containers on this Mac, using SSH and real application proofs accepted by Zeko. A shared local CPU inference server was used. On 23 November, a fresh unfamiliar agent also reproduced the mock and real-Gemma workflows from the archive with fresh company volumes and a fresh Zeko ledger, then verified both proofs and node states separately. The agent selected and assessed the tests; the parent mechanically executed its commands through the explicitly approved runtime because the agent's sandbox lacked runtime access. This remains same-machine agent-directed validation, not validation by another person or on separate physical hosts.

Next: test physical company hosts when available, replace synthetic identity with a trusted issuer/verifier, decide which real research output A may release, and evaluate whether that computation needs MPC. Full Zeko Ethereum settlement is an optional separate milestone, not a requirement for this execution-only demo.

## Version 0.4 demo and handoff

The package now includes coordinator and company-local browser dashboards, one-command startup/preflight, fresh-case evidence retention, interactive company approvals and bounded model proceed/review routing. Human review and model routing remain off by default. Turn submission is acknowledged once and followed through read-only status polling, allowing long proof/review execution without replaying state changes.

Reclaim integration uses a separately pinned SDK and reviewed provider hashes, exact claims and fresh session binding. Live credentials remain pending. Separate-host setup, scoped source bundles and an outside-developer validation template are included; physical hosts and an outside-human review remain pending. The bundled project skill links all setup and operating procedures and needs no author-private skill directory. See TESTED.md for actual checks and limits.
