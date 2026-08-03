#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
fail=0
git rev-parse --verify feature/payments >/dev/null && ok "branch exists" || { err "branch feature/payments missing"; fail=1; }
git cat-file -e feature/payments:payments.py 2>/dev/null && ok "payments.py on feature" || { err "payments.py missing on feature"; fail=1; }
if git cat-file -e main:payments.py 2>/dev/null; then err "payments.py should not be on main yet"; fail=1; else ok "main clean of feature file"; fi
exit $fail
