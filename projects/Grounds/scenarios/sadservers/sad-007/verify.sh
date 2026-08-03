#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-sad-dns ping -c1 -W2 example.com >/dev/null 2>&1 \
  || docker exec grounds-sad-dns nslookup example.com >/dev/null 2>&1 \
  || docker exec grounds-sad-dns wget -q -O- http://example.com >/dev/null 2>&1 \
  && ok "DNS works" || { err "still cannot resolve"; exit 1; }
