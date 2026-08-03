#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# create bare repo on host workspace simulating storage server
git init --bare "$WORKSPACE/nimbus.git" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-021 — Git Repository Setup on Storage Server

A bare repo already exists at nimbus.git (simulating storage server).

1. Clone it to `nimbus-work`
2. Add a README.md committing as user "Student <student@grounds.local>"
3. Push main/master branch back to the bare repo
EOF
ok "Bare repo at workspace/nimbus.git"
