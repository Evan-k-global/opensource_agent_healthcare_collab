# Independent developer handoff

A new developer should need only the source archive, this repository's skill, their normal Gemma/Antigravity knowledge, and the prerequisites in QUICKSTART. External live identity and physical-host validation remain pending until the relevant resources exist. Do not silently replace those checks with mocks.

## Reproduction procedure

1. Record the received archive SHA-256, date, OS/architecture, Node/Python/Docker/SDK versions and whether the tester is a human or an agent. Extract into a new directory with fresh state. Do not copy the author's `.local` or `.cache`.
2. Read `skills/research-collaboration/SKILL.md`, then run `python3 demo.py --mock --check`.
3. Run `python3 demo.py --mock --once --no-browser`. This is real application proving on native Zeko with a scripted model. Run `npm test` and `.venv/bin/python -m unittest discover -s antigravity -p 'test_*.py'`.
4. Save `.local/public-report.json` as `<evidence>/report.json`, `.local/public-evidence` as `<evidence>/proof`, and `.local/distributed/validation.json` as `<evidence>/validation.json`. Exclude everything else unless reviewed for privacy.
5. Run `npm run verify:evidence -- <evidence> --node`. All four checks must be true. This recompiles the expected circuit verification key and checks the saved proof and persisted ledger state.
6. Start a new case with `python3 demo.py --gemma --once --no-browser`. Record the model digest, both five-turn harness results and actualGemma=true. Save and independently verify its public evidence separately.
7. Exercise `--review --routing` using the company dashboards. Hold must pause; the peer/coordinator must not approve the other company's request; approve advances; reject stops. Record whether a person clicked or a test simulated it. Verify the coordinator view does not expose private rooms, while each company sees only its own internal room and the bilateral room.
8. For real hosts, use TWO_HOSTS and document actual physical separation independently. For live identity, use IDENTITY and record the provider/policy hash and successful fresh claim validation; never publish raw credential evidence.

## Outcome template

Copy `docs/validation-template.json` into your evidence directory and fill every status. `pending`, `failed` and `not-run` are valid outcomes. Include failures and environment accommodations, exact commands, source changes if any, actual topology, shared services, and whether caches/images were reused. An agent-directed test through another runtime must disclose that arrangement.

Return only the public receipt/proof/key, validation summaries, versions, source hash and reviewer report. Do not return keys, access files, SDK conversations, raw research/patient fields or private room logs. Do not send messages to third parties automatically; the project owner arranges the review.

## Stop

Ctrl-C stops the launcher services. `npm run hosts:stop` and `npm run zeko:stop` stop the local Docker services while preserving volumes. A fresh physical deployment's services are managed by its own administrators.
