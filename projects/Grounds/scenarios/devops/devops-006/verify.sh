#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
found=0
docker exec grounds-linux-lab bash -c 'crontab -l 2>/dev/null; cat /etc/cron.d/* 2>/dev/null' | grep -q heartbeat && found=1 || true
if [[ $found -eq 1 ]]; then ok "cron entry references heartbeat"; else err "no cron entry for heartbeat"; exit 1; fi
