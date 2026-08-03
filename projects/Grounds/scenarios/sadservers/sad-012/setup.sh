#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-sad-loop 2>/dev/null || true
# bad command causes restart loop
docker run -d --name grounds-sad-loop --restart unless-stopped alpine:3.20 sh -c "echo boom; exit 1" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-012 — Container restart loop

grounds-sad-loop is crash-looping. Diagnose with docker logs/inspect,
fix the root cause, and replace it with a healthy container of the same name
running `sleep infinity` or nginx.
EOF
ok "Fix restart loop container"
