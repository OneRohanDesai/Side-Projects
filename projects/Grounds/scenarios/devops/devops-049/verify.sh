#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
rep=$(kubectl --context kind-grounds get deploy nimbus-web -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
[[ "${rep:-0}" -ge 3 ]] && ok "readyReplicas=$rep" || { err "need 3 ready (have $rep)"; fail=1; }
kubectl --context kind-grounds get svc nimbus-web >/dev/null 2>&1 && ok "service exists" || { err "service nimbus-web missing"; fail=1; }
exit $fail
