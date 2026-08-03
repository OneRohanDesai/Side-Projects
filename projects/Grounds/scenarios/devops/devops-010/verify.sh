#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -x "$WORKSPACE/count_orders.sh" || -f "$WORKSPACE/count_orders.sh" ]] || { err "script missing"; exit 1; }
chmod +x "$WORKSPACE/count_orders.sh"
out=$(bash "$WORKSPACE/count_orders.sh" "$WORKSPACE/sample.csv" | tr -dc '0-9')
[[ "$out" == "3" ]] && ok "count=3" || { err "expected 3 got '$out'"; fail=1; }
set +e
bash "$WORKSPACE/count_orders.sh" /no/such/file >/dev/null 2>&1
rc=$?
set -e
[[ $rc -eq 2 ]] && ok "exit 2 on missing file" || { err "expected exit 2 on missing (got $rc)"; fail=1; }
exit $fail
