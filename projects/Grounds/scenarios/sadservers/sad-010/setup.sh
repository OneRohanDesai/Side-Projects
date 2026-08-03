#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE" "${GROUNDS_ROOT}/app/nimbus/nginx/certs"
# create expired-like weak cert situation: empty then student creates
rm -f "${GROUNDS_ROOT}/app/nimbus/nginx/certs/fullchain.pem" "${GROUNDS_ROOT}/app/nimbus/nginx/certs/privkey.pem"
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-010 — TLS certificate

Generate a self-signed cert for local Nimbus nginx:
- app/nimbus/nginx/certs/fullchain.pem
- app/nimbus/nginx/certs/privkey.pem
CN=localhost, 825 days.

Optionally enable SSL server block and reload grounds-nimbus-nginx.
Save `openssl x509 -in fullchain.pem -noout -subject` to cert-subject.txt
EOF
ok "Issue local TLS cert for Nimbus"
