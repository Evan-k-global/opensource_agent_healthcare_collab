# Start from a fresh checkout

This package contains the application, project skill, dummy data, fixtures, exact dependency manifests and operating instructions. You do not need the author's other repositories or private Codex skills. It uses the Antigravity Python SDK, not an assumed desktop extension.

## Prerequisites

- Node 20.19+ and npm.
- Python 3.10+ with venv. On a Mac whose system Python is 3.9, install a newer Python and run `python3.12` instead of `python3` below.
- Docker Engine with Compose; OrbStack works on macOS. Start it before the preflight.
- OpenSSH client and ssh-keygen.
- Initial internet access for pinned dependencies and container images. Allow several GB of disk space and at least 16 GB system RAM for the tested Apple Silicon profile. Proof work uses one worker per process.
- For real model inference: Ollama with `gemma4:e2b-it-q4_K_M` installed. Model weights and Ollama are separate downloads with upstream licenses.

## One command

From the extracted `research-collab-demo` directory:

```sh
python3 demo.py --mock --check
python3 demo.py --mock
```

The launcher installs missing dependencies into this checkout, creates `.venv`, starts the native Zeko execution localnet, builds two company hosts, launches their separate Antigravity processes, and opens three administrator views. The mock only replaces model responses; application proofs and native Zeko verification remain real.

Use actual Gemma:

```sh
ollama pull gemma4:e2b-it-q4_K_M
python3 demo.py --gemma
```

The harness checks backend state rather than trusting model narration. It permits one corrective model prompt for an idle, still-authorized step, and never submits a tool action itself. A second failure stops the run.

The dashboards remain available after the case completes. Ctrl-C stops this run's API, harness launchers, dashboards and SSH tunnels. Docker company hosts and Zeko remain running for reuse. See [operations](OPERATIONS.md) to stop them.

## Demo options

```sh
python3 demo.py --mock --fast                 # no cryptographic proofs, no Zeko needed
python3 demo.py --mock --review --routing     # actual administrator checkpoints, bounded model routing
python3 demo.py --gemma --new-case            # fresh case; preserves prior public receipt/proof
python3 demo.py --mock --once --no-browser    # automated validation and exit
```

Review and routing are OFF by default. In review mode, use A's and B's dashboards to approve their own requests; final settlement requires both. Hold pauses until an explicit approve/reject or the 15-minute review deadline. Reject stops the case. Model routing can pause for review but cannot grant authority. Do not leave an unattended review-enabled run expecting automatic approval.

Private dashboard links are written to `.local/dashboard-links.json`; they contain credentials. Open the relevant link locally. The coordinator view is at port 7420, A at 7421, B at 7422. A company view contains only that company's rooms/advice. No Slack workspace is needed.

## Success

The final public receipt `.local/public-report.json` reports `acceptedStateUpdate: true`; real Zeko mode also reports `applicationProofVerified: true` and `nodeRejectedAlteredTransaction: true`. `.local/distributed/validation.json` records both company harnesses and the actual model digest. Each company completes five turns. The UI displays proof simulation explicitly when using `--fast`.

For [separate hosts](TWO_HOSTS.md), [live identity integration](IDENTITY.md), [presenting the workflow](DEMO.md), or [independent validation](HANDOFF.md), follow those guides. The [project skill](../skills/research-collaboration/SKILL.md) is usable directly by any agent that can read Markdown; no skill installation is required.
