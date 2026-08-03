#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:18085/healthz || echo 000)
[[ "$code" == "200" ]] && ok "healthz 200" || { err "healthz returned $code"; exit 1; }
