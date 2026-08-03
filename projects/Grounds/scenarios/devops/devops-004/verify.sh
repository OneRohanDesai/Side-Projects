#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mode=$(docker exec grounds-linux-lab stat -c '%a' /opt/scripts/backup.sh)
[[ "$mode" == "750" || "$mode" == "740" || "$mode" == "700" ]] && ok "mode $mode" || { err "mode $mode unsafe (want 750/700)"; exit 1; }
# must not be world-writable or world-executable preferably
[[ "$mode" != "777" && "$mode" != "755" ]] || { err "still too open"; exit 1; }
ok "permissions hardened"
