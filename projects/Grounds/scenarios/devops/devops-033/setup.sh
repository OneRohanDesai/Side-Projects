#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
rm -rf .git
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "version=1" > config.txt
git add config.txt && git commit -m "base" >/dev/null
git checkout -b feature/a >/dev/null
echo "version=2a" > config.txt
git add config.txt && git commit -m "a" >/dev/null
git checkout main >/dev/null
git checkout -b feature/b >/dev/null
echo "version=2b" > config.txt
git add config.txt && git commit -m "b" >/dev/null
git checkout main >/dev/null
git merge feature/a -m "merge a" >/dev/null
set +e
git merge feature/b -m "merge b" >/dev/null 2>&1
set -e
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-033 — Resolving Git Merge Conflicts

feature/b merge into main conflicts on config.txt.
Resolve the conflict so the file contains `version=2-resolved`, commit the merge.
EOF
ok "Conflict induced — resolve it"
