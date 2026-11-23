# A five-minute narrative (allow extra time for proof compilation)

1. Start `python3 demo.py --mock` for predictable timing, or `--gemma` to demonstrate actual local model tool use. Identify the model mode and whether proofs are real before presenting.
2. Open Company A. Its researcher and reviewer discuss the fixed computation and aggregate-only disclosure in the internal room. Open Company B separately: it has its own room and patient-side plan.
3. Show the bilateral room. Only liaisons propose and accept the same plan. There is no Slack dependency; SantaClawz encrypted envelopes carry the messages.
4. Show the coordinator timeline. It sees progress, ciphertext delivery counts, identity mode and review metadata, not private room contents.
5. Explain the computation: A proves a permitted aggregate, sends its approved opening encrypted to B, and B combines it with private dummy inputs in a recursive proof. The model helps execute the bounded workflow; it does not prove medical reasoning.
6. Show the final receipt: native Zeko rejected an altered proof and accepted the valid application state. No Mina or Ethereum chain is needed, and no L1 batch settlement is claimed.

To demonstrate human checkpoints, start a fresh run with `--review`. In the appropriate company view click Hold, observe the stopped timeline, then Approve. At final settlement, each company approves separately. Reject ends the case. These are actual user decisions when clicked by a person; automated tests that click them are simulated reviewer interactions.

With `--routing`, the company-local adviser can choose proceed or hold for review. The current role, computation, permissions and disclosure budget remain fixed. A model cannot manufacture human approval.

Do not project private access links, tokens, SSH keys or raw runtime files. All supplied research/patient records are fictional. Identity is simulated unless the explicit provider flow succeeds; even that does not associate the synthetic computation with a real patient's records.
