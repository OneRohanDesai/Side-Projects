#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
curl -sf http://localhost:8080/health | jq -e '.status=="ok" or .checks.api=="ok"' >/dev/null && ok "health" || { err "api unhealthy"; fail=1; }
if [[ -f "$WORKSPACE/order.json" ]] && jq -e '.customer=="devops-046" or .id' "$WORKSPACE/order.json" >/dev/null; then
  ok "order.json present"
else
  # try detect via API
  if curl -sf http://localhost:8080/orders | jq -e '.[]|select(.customer=="devops-046")' >/dev/null; then
    ok "order found via API"
  else
    err "no order for devops-046"; fail=1
  fi
fi
exit $fail
