#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cert="${GROUNDS_ROOT}/app/nimbus/nginx/certs/fullchain.pem"
key="${GROUNDS_ROOT}/app/nimbus/nginx/certs/privkey.pem"
[[ -f "$cert" && -f "$key" ]] && ok "cert files exist" || { err "cert/key missing"; exit 1; }
openssl x509 -in "$cert" -noout -text >/dev/null && ok "cert parseable" || { err "bad cert"; exit 1; }
