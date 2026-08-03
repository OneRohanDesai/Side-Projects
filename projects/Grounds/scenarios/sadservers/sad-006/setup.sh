#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  # occupy port 8080 inside lab
  mkdir -p /var/practice
  nohup python3 -c "import http.server,socketserver; socketserver.TCPServer((\"0.0.0.0\",8080), http.server.SimpleHTTPRequestHandler).serve_forever()" >/tmp/blocker.log 2>&1 &
  echo $! > /var/practice/blocker.pid
  echo "#!/bin/bash" > /var/practice/start-api.sh
  echo "python3 -m http.server 8080 --bind 0.0.0.0" >> /var/practice/start-api.sh
  chmod +x /var/practice/start-api.sh
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-006 — Port conflict

start-api.sh cannot bind :8080. Find the process holding the port, stop it safely,
and leave a note of the culprit in culprit.txt (process name or pid story).
EOF
ok "Resolve port 8080 conflict in linux lab"
