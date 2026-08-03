#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
  # break: invalid directive and PermitRootLogin without care
  echo "PermitRootLogin no" >> /etc/ssh/sshd_config
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
  echo "BlargEnabled yes" >> /etc/ssh/sshd_config
  # keep current sshd running — student must fix config and validate with sshd -t
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-005 — Fix sshd_config

sshd_config has an invalid directive and overly strict settings for this lab.
1. Make `sshd -t` pass
2. Allow PasswordAuthentication yes for student user practice
3. Do not require BlargEnabled
Write fixed proof: output of sshd -t to sshd-t.txt in workspace (via docker exec).
EOF
ok "Fix sshd_config"
