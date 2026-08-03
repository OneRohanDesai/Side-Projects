#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c 'userdel -r tempuser 2>/dev/null || true' || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-002 — Temporary User Account Setup with Expiry

Create user **tempuser** that expires in 30 days (use `chage` or `useradd -e`).
EOF
ok "Create expiring user tempuser"
