#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /var/practice
  echo "#!/bin/bash" > /var/practice/heartbeat.sh
  echo "date >> /var/practice/heartbeat.log" >> /var/practice/heartbeat.sh
  chmod +x /var/practice/heartbeat.sh
  # remove any existing cron
  crontab -r 2>/dev/null || true
  rm -f /etc/cron.d/heartbeat
'
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-006 — Cron Job Scheduling in Linux

Schedule /var/practice/heartbeat.sh to run every 2 minutes as root.
Use either root crontab or /etc/cron.d/heartbeat.
EOF
ok "Schedule heartbeat cron"
