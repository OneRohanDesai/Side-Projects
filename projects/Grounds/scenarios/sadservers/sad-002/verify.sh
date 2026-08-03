#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'echo recovered >> /var/practice/logs/app.log' \
  && ok "log writable" || { err "still cannot write log"; exit 1; }
docker exec grounds-linux-lab bash -c 'test ! -f /var/practice/fill/junk1.bin -o ! -f /var/practice/fill/junk2.bin' \
  && ok "junk cleaned (at least partially)" || warn "junk files still present — preferred to delete"
docker exec grounds-linux-lab grep -q recovered /var/practice/logs/app.log && ok "recovered marker"
