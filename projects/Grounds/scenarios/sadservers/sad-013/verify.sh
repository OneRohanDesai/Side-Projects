#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
phase=$(kubectl --context kind-grounds get pod crashy -o jsonpath='{.status.phase}' 2>/dev/null || echo Missing)
[[ "$phase" == "Running" ]] && ok "Running" || { err "phase=$phase"; exit 1; }
