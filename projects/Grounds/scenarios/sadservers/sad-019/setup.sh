#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/deploy-repo"
cd "$WORKSPACE/deploy-repo"
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo v1 > version.txt
git add version.txt && git commit -m v1 >/dev/null
echo v2 > version.txt
git add version.txt && git commit -m v2 >/dev/null
# detach
git checkout HEAD~1 >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-019 — Git detached HEAD on deploy server

deploy-repo is in detached HEAD. Return to main branch tracking latest.
EOF
ok "Fix detached HEAD"
