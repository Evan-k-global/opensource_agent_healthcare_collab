# Skills, protocols and upstream references

The bundled [project skill](../skills/research-collaboration/SKILL.md) contains all project-specific operational guidance. Read it directly or install that folder through your agent's normal skill mechanism. Its relative references assume it remains in this repository; if your agent requires a global skill folder, link to this folder rather than copying it away from its docs.

No dependency on the author's private skill directory remains. Existing Gemma or Antigravity skills are optional aids; the scripts here use the documented versions and commands. The original protocol inventory and exact reused snapshots are recorded in [REVIEW](../REVIEW.md) and [NOTICE](../NOTICE).

- Zeko builder/operator docs and public agent skills: https://docs.zeko.io/ and https://docs.zeko.io/developers/tools/agent-skills . This package pins an execution-only development profile; do not substitute the heavier Ethereum-settling stack when reproducing it.
- o1js source and releases: https://github.com/o1-labs/o1js . The npm lock pins this package's circuit/runtime version.
- Antigravity Python SDK: https://pypi.org/project/google-antigravity/ . SDK version and resolved dependencies are in `antigravity/requirements-lock.txt`; the runnable model/harness adapter is bundled.
- Gemma model distribution: https://ollama.com/library/gemma4/tags . Runtime/model setup is in QUICKSTART and the main README; weights are not included.
- Ollama runtime: https://github.com/ollama/ollama . The original CPU run used 0.40.17.
- Reclaim verifier SDK and its documentation: https://github.com/reclaimprotocol/reclaim-js-sdk . Optional dependency is pinned separately in `integrations/reclaim` and retains its upstream license.
- SantaClawz envelope and mission-bound-auth source provenance: see NOTICE and the retained `vendor` directories. Private-room/admin behavior is implemented locally; no Slack account is needed.

These links are supporting references. The repository includes the code, setup, local test fixtures, scoped company exporter, identity policy example and review handoff needed for its own demo. It does not include third-party account credentials, model weights or external host access.
