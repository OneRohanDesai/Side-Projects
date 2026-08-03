#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cpu=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.limits.cpu}')
mem=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}')
[[ -n "$cpu" && -n "$mem" ]] && ok "limits cpu=$cpu mem=$mem" || { err "limits missing"; exit 1; }
req=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}')
[[ -n "$req" ]] && ok "requests set" || { err "requests missing"; exit 1; }
