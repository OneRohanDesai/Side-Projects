#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
inv="$WORKSPACE/inventory.ini"
out=$(ansible -i "$inv" app -m ping 2>/dev/null || true)
pongs=$(echo "$out" | grep -c '"ping": "pong"' || true)
[[ "${pongs:-0}" -ge 2 ]] && ok "app group reachable ($pongs)" || { err "ping failed ($pongs pongs)"; exit 1; }
