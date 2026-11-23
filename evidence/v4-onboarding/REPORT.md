# Independent-agent onboarding reproduction

Verdict: **PASS for fresh mock, proof-disabled onboarding.** Both independent company harnesses completed five turns, the in-process ledger accepted the state update, and the validation reported company room/credential boundaries checked. The fresh receipt explicitly reports `simulation-no-cryptographic-proof`, `applicationProofVerified: false`, `actualGemma: false`, and `realApplicationProofs: false`. No public proof directory was produced. Human review and model routing were off in this workflow run; identity was simulated.

This is an independent Codex subagent review and reproduction, **not an outside-human review or two-physical-machine validation**. The subagent selected commands, inspected source, checked lock metadata, read fresh public results and test logs, and prepared this report. The parent agent mechanically executed pip installation, preflight, launcher, tests and scoped cleanup in its approved runtime after the subagent sandbox denied package resolution, Docker access and loopback binding. Parent-reported real Gemma/native-Zeko runs are outside this reproduction's evidence. No historical evidence or primary private runtime files were inspected.

## Exact candidate and source

- Candidate: `reproduction-candidate-v04-rc3.zip`
- Archive SHA-256: `3b25278f804eff969775c744c9d387934e27c7c7670346a2cc1b18f6a843c77d`
- Source manifest: `source-manifest.json`, 125 files.
- Canonical manifest SHA-256: `16e409ad98602a3b5a009187b5dba0564824a3e0cc6dbfc0be27639f33540468`
- Canonical hashing: UTF-8 JSON with sorted keys and compact comma/colon separators. Individual file values are SHA-256 of raw bytes.
- Manifest excludes `docs/`, `evidence/`, Markdown, bytecode, runtime state, caches, virtual environments and installed dependencies. All 125 included files match both the received archive and the post-run checkout.
- No source changes were made by the reproducing agent. The archive excluded every `.local`, `.cache`, `.venv`, `node_modules` and `__pycache__` directory.

The bundled project skill, quickstart, operations and handoff instructions were sufficient to select the commands. Updated README/operations text describes the one corrective model prompt and `modelReprompts` field. Static review and mocked tests found no authority/replay defect: an accepted busy turn is followed with GET requests, while a corrective prompt requires fresh authorization for the same idle step. This mock workflow needed zero corrective prompts.

## Environment and dependencies

The test used one macOS physical host, Node 20.20.0, npm 10.8.2, Python 3.12.16, OpenSSH 9.4p1 and Docker Compose 5.5.0. Exact successful preflight details are in `outcome.json`. Two Linux company containers used the distinct Compose project `v4-onboarding-hosts`; their state/cache volumes and SSH keys were newly created for this reproduction. The parent confirmed original company containers were stopped before the run. Primary Zeko was not used or stopped.

A fresh checkout `node_modules` was installed from the shared npm download cache; **109 installed package records** match package-lock versions and integrity values. A new checkout `.venv` was created using an existing Python 3.12 executable; installed packages were not copied from another checkout. **All 43 Python pins** match installed distribution metadata, including `google-antigravity==0.1.10`. Lockfiles were byte-identical across candidate refreshes, so these independently installed dependencies were retained when RC3 source was extracted. Existing Docker image/build layers and download caches could be reused; this was not an empty-machine or empty-cache installation.

## Commands and execution accommodations

Commands ran in `work/v4-onboarding/research-collab-demo`. For legibility, `$WORK` below denotes the absolute workspace `work` directory and `$PYTHON312` denotes its `antigravity-venv/bin/python` executable. These are environment locations, not additional project source dependencies.

```sh
env npm_config_cache="$WORK/npm-cache" npm ci --ignore-scripts --offline --no-audit --no-fund
"$PYTHON312" -m venv .venv
env PIP_CACHE_DIR="$WORK/v4-onboarding/pip-cache" .venv/bin/python -m pip install --disable-pip-version-check --retries 0 --timeout 20 -r antigravity/requirements-lock.txt
```

The subagent's pip attempt could not resolve `absl-py==2.5.1`; parent execution of the selected installation command succeeded. The launcher ran its own `npm ci --ignore-scripts` again because its installation marker was absent; dependencies were rechecked afterward.

The following environment was supplied to each preflight/launcher command:

```sh
env -u COMPANY_REMOTE_CONFIG -u COMPANY_SSH_CONFIG -u WORKER_ISOLATION -u IDENTITY_PROVIDER_CONFIG   COMPOSE_PROJECT_NAME=v4-onboarding-hosts   DOCKER_CONFIG="$WORK/docker-config"   DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"   npm_config_cache="$WORK/npm-cache"   PIP_CACHE_DIR="$WORK/v4-onboarding/pip-cache"   .venv/bin/python demo.py --mock --fast --check
```

The second invocation used the same environment and `demo.py --mock --fast --once --no-browser`. Direct subagent preflight reported Docker access failure and `EPERM` on loopback binding; parent execution passed every preflight check and the launcher exited 0.

```sh
npm test
.venv/bin/python -m unittest discover -s antigravity -p 'test_*.py'
```

Final tests: **23/23 Node tests and 7/7 Python tests passed**, exit 0. The first Node invocation was mistakenly started by the parent while the launcher's `npm ci` was replacing `node_modules`; it reported missing/truncated o1js WASM and 3 failures. The installation completed, then the same suite ran sequentially and passed. This execution-order error is preserved in `test-summary.json`; no source change was used to resolve it. Authorization and private-room checks include the automated tests and the fresh harness assertions; this report does not claim human-operated browser acceptance testing.

Cleanup used only the reproduction project:

```sh
env COMPOSE_PROJECT_NAME=v4-onboarding-hosts   DOCKER_CONFIG="$WORK/docker-config"   DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"   npm run hosts:stop
```

The resulting Compose state independently confirms both reproduction company containers exited with code 0. Volumes were preserved. No command targeted primary Zeko or removed volumes.

## Evidence and limits

`report.json` is the fresh public receipt; `validation.json` retains public-safe harness/boundary summaries; `dependency-check.json`, `test-summary.json`, `cleanup.json`, `outcome.json` and `source-manifest.json` document the checks. Keys, credentials, access links, private SDK conversations, room logs and raw inputs are excluded.

This run provides no cryptographic application proof, native Zeko altered-proof rejection, real Gemma inference, live Reclaim credential validation, physical-host separation or outside-human review. Those remain separate validation scopes. No unresolved onboarding blocker was found within the tested mock/fast scope.
