#!/bin/bash
set -euo pipefail
export ZEKO_CIRCUITS_CONFIG=/config/circuits.json
export ZEKO_SIGNATURE_KIND=testnet
export ZEKO_SIGNER_AUTH_TOKEN="$(cat /config/signer.token)"
case "$1" in
  signer)
    export MINA_PRIVATE_KEY="$(cat /config/sequencer.key)"
    exec /bin/zeko-signer run --host 0.0.0.0 --port 9000 --allow-insecure-remote-binding --allow-field-signing --allow-zkapp-signing --max-fee 1 --max-balance-change 0
    ;;
  da)
    exec /bin/zeko-da run-node --port 8080 --db-dir /da --signer signer:9000 --network-id testnet
    ;;
  development-prover)
    exec /bin/zeko-prover-fake run-server --mq-host queue:5672
    ;;
  sequencer)
    exec /bin/zeko-run-fake -p 1923 --l1-uri http://bootstrap-metadata:8080/graphql --archive-uri http://bootstrap-metadata:8080/graphql \
      --signer signer:9000 --mq-host queue:5672 --postgres-uri postgresql://research:research@postgres:5432/sequencer \
      --db-dir /ledger --checkpoints-dir /checkpoints --commitment-period 0 --da-keys "$(cat /config/sequencer.pub)" --da-quorum 0 --da-node da:8080
    ;;
  *) exit 2 ;;
esac
