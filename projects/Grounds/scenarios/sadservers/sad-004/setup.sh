#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  echo "#!/bin/bash" > /usr/local/bin/backup-nimbus.sh
  echo "date >> /var/practice/backup.log" >> /usr/local/bin/backup-nimbus.sh
  chmod 644 /usr/local/bin/backup-nimbus.sh   # not executable — bug
  echo "* * * * * root /usr/local/bin/backup-nimbus.sh" > /etc/cron.d/nimbus-backup
  # bad: missing newline sometimes matters; ensure cron runs
  service cron start 2>/dev/null || cron || true
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-004 — Cron job not firing

Backup cron is installed but never writes /var/practice/backup.log.
Find why and fix. Trigger once manually if needed to prove, and leave cron correct.
EOF
ok "Fix backup cron"
