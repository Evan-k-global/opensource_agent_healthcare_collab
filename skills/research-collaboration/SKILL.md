---
name: research-collaboration
description: Set up, demonstrate, validate, or extend this private two-company research zkApp using local Zeko, SantaClawz envelopes, scoped Antigravity harnesses, and Gemma. Use inside this project; public-chain deployment and real clinical workflows require separate scope.
---

# Private research collaboration

Resolve the project root as the directory containing `package.json` and either `demo.py` (full coordinator checkout) or `company-bundle.json` (scoped company host). In a company bundle, follow the host installation section of [separate-host setup](../../docs/TWO_HOSTS.md); the coordinator launcher is intentionally absent. Commands below otherwise run in the full checkout. No author-specific filesystem paths, preinstalled Codex skills, wallets, Slack account, or public-chain funds are needed.

Read [quickstart](../../docs/QUICKSTART.md) for a fresh checkout and [demo walkthrough](../../docs/DEMO.md) when presenting. Run `python3 demo.py --mock --check` before startup. Python must be 3.10+. `python3 demo.py --mock` starts a reproducible real-proof Zeko demo; `--gemma` uses installed local Gemma. Both keep dashboards open after completion. `--fast` is explicitly proof-disabled. Human review and model routing are off unless requested with `--review` / `--routing`.

Use company dashboard links from `.local/dashboard-links.json` privately. Company A, Company B, and coordinator views have distinct tokens; never publish these links. Approval decisions must come from the appropriate company administrator. A demonstration script may simulate approvals only if the resulting evidence labels them simulated. A coordinator credential cannot approve for either company. Do not auto-approve a user's paused run.

Important invariants:
- This pinned native Zeko development profile needs neither Mina nor Ethereum. Keep L1 commits disabled, DA quorum zero, and the development rollup prover. Application proofs are real when `--fast` is absent. Never equate ledger acceptance with L1 settlement.
- Keep model endpoints company-local. The local-container demo shares one Ollama server; the [separate-host profile](../../docs/TWO_HOSTS.md) uses each host's own server.
- A stale model answer may receive one corrective model prompt only after an own-agent status check confirms the same case/step is idle and authorized. Accepted work is polled, never resubmitted by the harness; check `modelReprompts` in validation evidence.
- Agent tools are only status and authorized turn execution. Preserve holder signatures, fixed circuit, exact plan agreement, one-run budgets, scoped channels and proof checks.
- The coordinator dashboard contains progress metadata. Private room summaries are served by the respective company host; do not aggregate them into coordinator responses or public reports.
- A model can recommend proceeding or review within the current role. It cannot become an administrator, change the computation, or bypass a checkpoint.
- Identity is simulated by default. Read [identity integration](../../docs/IDENTITY.md) before enabling Reclaim. An SDK-verified credential and local attestation are not a ZK identity circuit or proof that dummy computation inputs correspond to a real patient.

For testing or handoff, use [validation and external-review procedure](../../docs/HANDOFF.md). Verify the saved proof with `npm run verify:evidence -- <public-evidence-directory>`; `--node` also requires that run's preserved ledger. Record the tested revision/hash, model digest, actual topology, proof mode, identity mode and reviewer identity. A container or unfamiliar agent run does not count as a physical-host or outside-human run.

Logs, access files, SSH keys, SDK sessions and private reports live in `.local`; proving caches live in `.cache`. Neither directory belongs in a public source archive. Use [operations](../../docs/OPERATIONS.md) for restart, shutdown and stale-lock recovery. Do not erase ledger volumes to reset a case.

Upstream references and protocol provenance are in [sources](../../docs/SOURCES.md). Prefer the included pinned commands over unrelated newest upstream deployments. Run `npm test` after authority, disclosure, identity or workflow changes, and rerun the affected end-to-end mode when those changes affect execution.
