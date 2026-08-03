#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# port should be free OR our start script can bind
docker exec grounds-linux-lab bash -c '
  if ss -lntp | grep -q ":8080 "; then
    # if something listens, it should be start-api related after student fix — just ensure not the original blocker pid
    if [[ -f /var/practice/blocker.pid ]] && kill -0 $(cat /var/practice/blocker.pid) 2>/dev/null; then
      exit 1
    fi
  fi
  exit 0
' && ok "blocker cleared" || { err "blocker still holding 8080"; exit 1; }
