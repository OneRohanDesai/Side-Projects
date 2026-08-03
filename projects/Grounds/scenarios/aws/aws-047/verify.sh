#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local sns list-topics | grep -q nimbus-alerts && ok "topic exists" || { err "topic missing"; fail=1; }
aws_local sqs get-queue-url --queue-name nimbus-alerts-queue >/dev/null && ok "queue exists" || { err "queue missing"; fail=1; }
if [[ -f "$WORKSPACE/message.txt" ]] && grep -q 'nimbus-health-ok' "$WORKSPACE/message.txt"; then
  ok "message received"
else
  # soft: try receive now
  url=$(aws_local sqs get-queue-url --queue-name nimbus-alerts-queue --query QueueUrl --output text 2>/dev/null || true)
  if [[ -n "$url" ]]; then
    aws_local sqs receive-message --queue-url "$url" --max-number-of-messages 1 >"$WORKSPACE/recv.json" || true
    if grep -q nimbus-health-ok "$WORKSPACE/recv.json" 2>/dev/null; then ok "message in queue"; else err "message not found — publish + receive"; fail=1; fi
  else
    fail=1
  fi
fi
exit $fail
