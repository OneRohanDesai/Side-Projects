#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-035 — Docker Installation and Service Management

On the host (you already have Docker), demonstrate service management:

1. Write `docker-status.sh` that prints `ok` if docker daemon is reachable
2. Ensure a container named `grounds-hello` runs `nginx:alpine` publishing 18081:80
3. Container must restart=unless-stopped
EOF
ok "Manage Docker service + hello container"
