#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  service nginx stop 2>/dev/null || true
  # break config
  mkdir -p /etc/nginx/sites-enabled /var/www/html
  echo "server { listen 80; root /var/www/html; }" > /etc/nginx/sites-enabled/default
  # intentional syntax error in a conf
  echo "server { listen 80 broken_directive; }" > /etc/nginx/conf.d/broken.conf
  echo "<h1>Nimbus Lab Site</h1>" > /var/www/html/index.html
  # disable main service
  rm -f /run/nginx.pid
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-001 — Broken Nginx

Nginx will not serve on port 80 inside the linux lab (mapped host :8081).
Find the config error, fix it, start nginx, ensure index is served.
EOF
ok "Nginx is broken — fix it"
