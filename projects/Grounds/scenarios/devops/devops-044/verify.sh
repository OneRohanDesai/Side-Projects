#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -f "$WORKSPACE/docker-compose.yml" || -f "$WORKSPACE/compose.yaml" ]] && ok "compose file exists" || { err "compose file missing"; fail=1; }
curl -sf http://localhost:18084/ >/dev/null && ok "web reachable" || { err "web not on :18084"; fail=1; }
exit $fail
