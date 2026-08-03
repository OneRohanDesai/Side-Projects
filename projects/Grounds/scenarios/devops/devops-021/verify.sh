#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
git --git-dir="$WORKSPACE/nimbus.git" rev-parse HEAD >/dev/null 2>&1 && ok "bare repo has commits" || { err "no commits on bare repo"; fail=1; }
git --git-dir="$WORKSPACE/nimbus.git" cat-file -e HEAD:README.md 2>/dev/null && ok "README.md in repo" || { err "README.md missing in bare repo"; fail=1; }
exit $fail
