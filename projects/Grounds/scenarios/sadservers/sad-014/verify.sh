#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
eps=$(kubectl --context kind-grounds get endpoints web-backend -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)
[[ -n "$eps" ]] && ok "endpoints: $eps" || { err "no endpoints"; exit 1; }
