#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-nginx 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-036 — Nginx Container Deployment with Docker

Run nginx in Docker:
- name: grounds-nginx
- image: nginx:1.27-alpine
- publish 18082:80
- mount workspace/html → /usr/share/nginx/html:ro
- custom index.html saying "Nimbus via Docker"
EOF
mkdir -p "$WORKSPACE/html"
ok "Deploy nginx container with custom content"
