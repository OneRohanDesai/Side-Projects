#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
rm -rf .git 2>/dev/null || true
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "base" > app.txt
git add app.txt && git commit -m "init" >/dev/null
git checkout -b feature/payments >/dev/null
echo 'def charge(): return 42' > payments.py
git add payments.py && git commit -m "add payments" >/dev/null
git checkout main >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-025 — Git Branch Merging

Merge `feature/payments` into `main` (no FF preferred but not required).
Main must contain payments.py after merge.
EOF
ok "Merge feature/payments into main"
