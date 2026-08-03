#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# break nginx upstream health path in a local proxy config student can fix
cat >"$WORKSPACE/nginx-lb.conf" <<'EOF'
upstream api {
  server host.docker.internal:8080;
}
server {
  listen 80;
  location /healthz {
    proxy_pass http://api/health-wrong;
  }
  location / {
    proxy_pass http://api/;
  }
}
EOF
docker rm -f grounds-sad-lb 2>/dev/null || true
docker run -d --name grounds-sad-lb -p 18085:80 \
  -v "$WORKSPACE/nginx-lb.conf:/etc/nginx/conf.d/default.conf:ro" \
  --add-host=host.docker.internal:host-gateway \
  nginx:1.27-alpine >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-018 — Load balancer health checks failing

grounds-sad-lb proxies to Nimbus but /healthz is wrong.
Fix nginx-lb.conf so /healthz returns 200 from the real /health endpoint,
then reload/recreate the container.
EOF
ok "Fix LB health check path"
