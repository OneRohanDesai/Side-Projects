#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
aws_local sqs create-queue --queue-name nimbus-jobs >/dev/null 2>&1 || true
url=$(aws_local sqs get-queue-url --queue-name nimbus-jobs --query QueueUrl --output text)
for i in 1 2 3 4 5; do
  aws_local sqs send-message --queue-url "$url" --message-body "{\"job\":$i}" >/dev/null
done
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-016 — SQS consumer lag

Queue nimbus-jobs has messages. Drain them (receive+delete) until approximate count is 0.
Save final attributes to queue-attrs.json.
Optionally fix worker env SQS_QUEUE_URL if using Nimbus worker.
EOF
echo "$url" >"$WORKSPACE/queue-url.txt"
ok "Drain nimbus-jobs queue"
