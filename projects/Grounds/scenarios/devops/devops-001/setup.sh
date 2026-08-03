#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# clean previous
docker exec grounds-linux-lab bash -c 'userdel -r amanda 2>/dev/null || true' || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-001 — Linux User Creation with Non-Interactive Shell

Inside the Linux lab (`grounds shell` or `docker exec -it grounds-linux-lab bash`):

Create user **amanda** with:
- non-interactive shell (`/sbin/nologin` or `/usr/sbin/nologin`)
- home directory present
- comment/gecos: "Amanda App Service"

Do NOT set a password (service account style).
EOF
ok "Linux lab ready — create user amanda"
