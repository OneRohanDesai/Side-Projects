#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
kubectl --context kind-grounds get secret nimbus-db >/dev/null && ok "secret exists" || { err "secret missing"; fail=1; }
# decode check
user=$(kubectl --context kind-grounds get secret nimbus-db -o jsonpath='{.data.username}' | base64 -d)
[[ "$user" == "nimbus" ]] && ok "username ok" || { err "username mismatch"; fail=1; }
phase=$(kubectl --context kind-grounds get pod secret-consumer -o jsonpath='{.status.phase}' 2>/dev/null || echo Missing)
[[ "$phase" == "Running" ]] && ok "pod Running" || { err "pod phase=$phase"; fail=1; }
exit $fail
