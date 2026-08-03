#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-sad-dns 2>/dev/null || true
docker run -d --name grounds-sad-dns --dns 127.0.0.1 alpine:3.20 sleep infinity >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-007 — DNS resolution broken in container

Container grounds-sad-dns cannot resolve hostnames (bad --dns).
Fix it (recreate with good DNS or fix resolv.conf) so `nslookup example.com` or `ping -c1 example.com` works.
EOF
ok "Fix DNS for grounds-sad-dns"
