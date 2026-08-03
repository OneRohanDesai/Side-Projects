#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab test -x /usr/local/bin/backup-nimbus.sh && ok "script executable" || { err "script not executable"; exit 1; }
docker exec grounds-linux-lab bash /usr/local/bin/backup-nimbus.sh
docker exec grounds-linux-lab test -s /var/practice/backup.log && ok "log written" || { err "log empty"; exit 1; }
