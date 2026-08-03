#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
git checkout main >/dev/null
git cat-file -e main:payments.py && ok "payments.py on main" || { err "not merged"; exit 1; }
