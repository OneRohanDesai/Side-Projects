#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/app"
cat >"$WORKSPACE/app/app.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(b"nimbus-dockerfile-ok")
    def log_message(self, *args): pass
HTTPServer(("0.0.0.0", 8000), H).serve_forever()
PY
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-041 — Writing Dockerfiles

Write a Dockerfile for workspace/app that:
- uses python:3.12-slim
- runs app.py on port 8000
- HEALTHCHECK curls or wget localhost:8000

Build as `grounds-practice-app:1` and run as `grounds-practice-app` on host port 18083.
EOF
ok "Write Dockerfile and run the app"
