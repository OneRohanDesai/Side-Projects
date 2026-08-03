#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# seed a minimal compose project for nimbus-lite
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-044 — Docker Compose File Creation

Create docker-compose.yml in this workspace that runs:
1. redis:7-alpine service name `cache`
2. a simple whoami (traefik/whoami) service name `web` publishing 18084:80
3. web depends_on cache

Bring the stack up with project name `grounds-compose-lab`.
EOF
ok "Author and start docker-compose.yml"
