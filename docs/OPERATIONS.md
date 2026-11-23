# Operation and recovery

Run one launcher per checkout. Each run generates a new case and scoped credentials. `--new-case` makes that intent explicit; it does not delete chain state. Prior public proof/report/validation files are copied into `.local/runs/<timestamp>`. Private SDK conversations remain under company-local case directories. Do not copy `.local` into a public handoff.

## Stop

Ctrl-C stops the active launcher and its child services. Then, if desired:

```sh
npm run hosts:stop
npm run zeko:stop
```

Use the same `COMPOSE_PROJECT_NAME` override if you started a custom project. Do not run `docker compose down -v` as a routine reset; it deletes evidence-bearing ledger/company volumes. The launcher never stops unrelated stacks.

## Recovery

- **Docker unavailable:** Start Docker/OrbStack normally, verify `docker ps`, rerun `--check`.
- **Port in use:** Stop the previous launcher gracefully. Ports 17410 (API), 17411 (mock), 7420–7422 (dashboards), 22221–22222 (company SSH) and 19230 (Zeko) are the local defaults. Do not terminate unknown processes.
- **Stale `.local/demo.lock`:** Read its PID, verify the corresponding launcher is no longer running, then remove only that lock file. Never remove a lock while a case is active.
- **Sandbox Docker cache denied:** Use a writable Docker configuration directory and an explicit engine socket, preserving your intended Docker context. This is environment-specific; normal terminals usually need no override. Never disable SSH host-key checks.
- **npm/pip cache denied:** Set `npm_config_cache` and `PIP_CACHE_DIR` to writable directories, then rerun. Do not change ownership of unrelated home directories.
- **Gemma absent:** Install the documented tag. If Metal is unavailable in a sandbox, use the CPU environment shown in the main README. CPU runs are slower. The real-model path never substitutes scripted responses.
- **A model fails a tool call or requests hold with routing off:** Inspect that company's private logs. The harness permits one corrective model prompt only when a fresh status check confirms the same step is idle and still authorized. An accepted busy turn is followed with GET requests; it is never resubmitted by the harness. If the correction fails, the case stops with no scripted fallback. Start a fresh case after resolving the cause.
- **Proof compilation seems slow:** Cold compilation can take minutes. Read-only status requests retry within the harness deadline. Do not restart the backend during proof generation; that changes case credentials.
- **Review paused:** Open the correct company dashboard. Coordinator tokens cannot approve. A held request can later be approved/rejected; a resolved or stale request cannot be replayed.
- **Identity startup waits:** Only an explicitly configured Reclaim provider causes external identity requests. Open the private request link and finish the provider flow before expiry. Otherwise stop, fix configuration and start a fresh case.

Logs: `.local/distributed/`. Public evidence: `.local/public-evidence/` and `.local/public-report.json`. Company summaries are inside their own host at `.local/company-a|b/admin-report.json`; use the company dashboard or the documented SSH command. The coordinator does not fetch private summaries for its dashboard.
