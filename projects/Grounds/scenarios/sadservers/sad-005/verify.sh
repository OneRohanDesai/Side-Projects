#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'sshd -t' && ok "sshd -t clean" || { err "sshd -t failed"; exit 1; }
docker exec grounds-linux-lab grep -q '^BlargEnabled' /etc/ssh/sshd_config && { err "invalid directive remains"; exit 1; } || ok "bad directive removed"
