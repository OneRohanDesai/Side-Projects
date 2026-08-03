#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local lambda get-function --function-name nimbus-s3-processor >/dev/null && ok "lambda exists" || { err "lambda missing"; fail=1; }
notif=$(aws_local s3api get-bucket-notification-configuration --bucket nimbus-events 2>/dev/null || echo '{}')
echo "$notif" | jq -e '.LambdaFunctionConfigurations | length >= 1' >/dev/null \
  && ok "notification configured" || { err "no lambda notification on bucket"; fail=1; }
exit $fail
