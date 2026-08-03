#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -f "$WORKSPACE/app/Dockerfile" || -f "$WORKSPACE/Dockerfile" ]] && ok "Dockerfile present" || { err "Dockerfile missing"; fail=1; }
docker image inspect grounds-practice-app:1 >/dev/null 2>&1 && ok "image built" || { err "image grounds-practice-app:1 missing"; fail=1; }
body=$(curl -sf http://localhost:18083/ || true)
echo "$body" | grep -q nimbus-dockerfile-ok && ok "service responds" || { err "not responding on :18083"; fail=1; }
exit $fail
