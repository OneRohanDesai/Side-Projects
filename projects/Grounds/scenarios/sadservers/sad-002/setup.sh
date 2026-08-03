#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /var/practice/logs /var/practice/fill
  # create large junk files (not truly full disk — simulate)
  dd if=/dev/zero of=/var/practice/fill/junk1.bin bs=1M count=200 2>/dev/null
  dd if=/dev/zero of=/var/practice/fill/junk2.bin bs=1M count=200 2>/dev/null
  # "app" cannot write because directory is immutable-like via permissions
  touch /var/practice/logs/app.log
  chattr +i /var/practice/logs/app.log 2>/dev/null || chmod 000 /var/practice/logs
  echo "APP_LOG=/var/practice/logs/app.log" > /var/practice/app.env
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-002 — Disk full / cannot write logs

The app cannot write to /var/practice/logs/app.log.
Investigate (du, df, lsattr, permissions). Free the junk in /var/practice/fill
and make the log writable again. Write a line "recovered" to the log.
EOF
ok "Recover disk/log write path"
