#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker inspect grounds-nginx >/dev/null 2>&1 || { err "container missing"; exit 1; }
body=$(curl -sf http://localhost:18082/ || true)
echo "$body" | grep -qi nimbus && ok "content ok" || { err "content missing Nimbus"; fail=1; }
exit $fail
