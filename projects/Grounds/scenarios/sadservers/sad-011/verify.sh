#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -S INPUT | grep -q "dport 80"' \
  && ok "port 80 allowed" || { err "port 80 not allowed"; exit 1; }
