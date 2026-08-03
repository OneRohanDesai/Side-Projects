#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# wait a moment
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:8080/health | jq -e '.checks.postgres=="ok"' >/dev/null 2>&1; then
    ok "postgres healthy"; exit 0
  fi
  sleep 2
done
err "postgres still failing health"; exit 1
