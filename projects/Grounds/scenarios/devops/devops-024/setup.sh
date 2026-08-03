#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "base" > app.txt
git add app.txt && git commit -m "init" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-024 — Git Branch Creation and Management

In workspace/repo:
1. Create branch `feature/payments`
2. Add payments.py with a function charge()
3. Commit on that branch
4. Ensure main does NOT contain payments.py yet
EOF
ok "Repo ready — create feature/payments branch"
