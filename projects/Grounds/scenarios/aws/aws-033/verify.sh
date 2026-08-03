#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
aws_local lambda get-function --function-name nimbus-hello >/dev/null
ok "function nimbus-hello exists"
out=$(aws_local lambda invoke --function-name nimbus-hello --payload '{"name":"grounds"}' "$WORKSPACE/invoke-verify.json" --query StatusCode --output text 2>/dev/null || echo fail)
if [[ "$out" == "200" ]]; then ok "invoke ok"; else err "invoke failed"; exit 1; fi
if grep -q 'grounds' "$WORKSPACE/invoke-verify.json" 2>/dev/null; then ok "payload greets grounds"; else warn "check response body"; fi
