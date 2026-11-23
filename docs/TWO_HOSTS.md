# Separate company hosts

This is a runnable SSH profile and handoff. Two physical hosts and an outside developer are pending; local container validation does not count as either. `--require-distinct-hosts` detects matching reported host identities, but VM/container hostnames can differ on the same physical machine. A reviewer must independently record the real topology.

The coordinator machine runs Zeko, the backend and operator dashboard. Each company machine runs its own worker, Antigravity process, three roles, private dashboard, data and Ollama server. Only the API is reverse-forwarded from the coordinator. Model traffic stays on each company host; it is not forwarded to the coordinator in remote mode.

## Prepare each company

Generate company-specific bundles on the coordinator:

```sh
python3 deployment/export_company.py a
python3 deployment/export_company.py b
```

Transfer `.local/handoff/company-a.tar.gz` only to A and the B bundle only to B through your authorized transport. Each bundle excludes peer fixtures, runtime state, keys and installed dependencies and includes file hashes in `company-bundle.json`.

On each host, extract into an absolute directory such as `/srv/research-collab-demo` (or an owned directory), then:

```sh
cd /srv/research-collab-demo
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/pip install -r antigravity/requirements-lock.txt
ollama pull gemma4:e2b-it-q4_K_M
```

Start that host's local Ollama server. Node 20.19+, Python 3.10+, SSH server and ordinary local filesystem access are required. The machine must contain only its own `fixtures/company-a` or `fixtures/company-b` directory. Use independently administered OS accounts and per-company private runtime storage.

## Configure SSH and model endpoints

Create a private SSH config with aliases for A and B. Pin each server's host key using a fingerprint obtained through a trusted channel. Set `StrictHostKeyChecking yes`, `BatchMode yes`, `IdentitiesOnly yes`, and the correct key/user/port. Do not blindly trust `ssh-keyscan` output or disable verification. Server forwarding must permit the reverse loopback API port 17410 and local forwards to its own dashboard port (7421 for A, 7422 for B). Keep forwarding bound to loopback.

Create a private company config from `examples/company-hosts-v4.json`. Set each alias, absolute installation directory, absolute `.venv/bin/python`, model name and company-local `http://127.0.0.1:11434/v1`. The same loopback address refers to different servers on separate hosts.

On the coordinator:

```sh
python3 demo.py --gemma \
  --remote-config /absolute/private/companies.json \
  --ssh-config /absolute/private/ssh-config \
  --require-distinct-hosts
```

The coordinator still needs Docker for Zeko unless using `--fast` for explicit proof simulation. SSH workers/harnesses run on the configured hosts; the launcher does not create or modify cloud infrastructure. The profile checks peer-fixture absence, own credential/role ownership, private-room boundaries, installed Gemma metadata and native proof/state behavior.

Admin links are local to the coordinator via SSH forwarding. Each company can also open its dashboard locally using its own `.local/company-a|b/admin.access.json` token. The coordinator's administrator dashboard API has no private-room payload. The deployment operator who provisions SSH and distributes credentials is trusted; this demo is not hostile-operator isolation.

## Evidence and acceptance

Follow [HANDOFF.md](HANDOFF.md). Record host operating systems, independently confirmed physical separation, per-host Gemma digest, company ownership and actual proof results. Do not infer physical separation from `distinctReportedHostIds`. Remote results intentionally leave `physicalMachines` null until independently confirmed. Keep raw host identifiers and private logs out of the public report.
