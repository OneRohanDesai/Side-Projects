#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# host port 8081 maps to container 80
body=$(curl -sf http://localhost:8081/ || docker exec grounds-linux-lab curl -sf http://127.0.0.1/ || true)
echo "$body" | grep -qi nimbus && ok "site served" || { err "not serving"; exit 1; }
