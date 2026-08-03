#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-047 — Reliable Messaging with SQS and SNS

1. Create SNS topic **nimbus-alerts**
2. Create SQS queue **nimbus-alerts-queue**
3. Subscribe the queue to the topic
4. Publish a message "nimbus-health-ok" to the topic
5. Receive it from the queue (save body to message.txt)
EOF
ok "Build SNS→SQS fan-in for nimbus alerts"
