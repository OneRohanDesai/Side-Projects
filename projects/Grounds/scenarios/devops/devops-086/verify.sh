#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# live verify by running ping if student file incomplete
inv="$WORKSPACE/inventory.ini"
if [[ -f "$WORKSPACE/ping.txt" ]] && grep -c pong "$WORKSPACE/ping.txt" | grep -qE '^[3-9]'; then
  ok "ping.txt shows pongs"
  exit 0
fi
out=$(ansible -i "$inv" all -m ping 2>/dev/null || true)
echo "$out" >"$WORKSPACE/ping-verify.txt"
pongs=$(echo "$out" | grep -c '"ping": "pong"' || true)
[[ "${pongs:-0}" -ge 3 ]] && ok "ansible ping pong x$pongs" || { err "need 3 pongs (got $pongs). Is ansible lab up?"; exit 1; }
