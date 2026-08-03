#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/practice /workspaces /var/log/practice
service ssh start 2>/dev/null || /usr/sbin/sshd || true
# cron
service cron start 2>/dev/null || cron || true

# Default nginx placeholder
if [[ ! -f /var/www/html/index.html ]]; then
  mkdir -p /var/www/html
  echo '<h1>Grounds Linux Lab</h1>' > /var/www/html/index.html
fi

echo "Grounds Linux lab ready. Users: student/student root/grounds" \
  > /var/practice/READY

# Keep container alive
exec sleep infinity
