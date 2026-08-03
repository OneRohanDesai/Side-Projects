#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /opt/scripts
  echo "#!/bin/bash" > /opt/scripts/backup.sh
  echo "echo backup" >> /opt/scripts/backup.sh
  chmod 777 /opt/scripts/backup.sh
  chown root:root /opt/scripts/backup.sh
'
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-004 — Linux Script Permission Management

Fix /opt/scripts/backup.sh permissions to be production-safe:
- owner root, group student (or a dedicated group)
- mode 750 (rwxr-x---) — executable by owner/group only, not world
EOF
ok "Broken permissions applied — harden backup.sh"
