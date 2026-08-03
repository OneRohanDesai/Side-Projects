#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  useradd -m deploy 2>/dev/null || true
  mkdir -p /opt/nimbus
  echo "app" > /opt/nimbus/app.txt
  chown root:root /opt/nimbus /opt/nimbus/app.txt
  chmod 700 /opt/nimbus
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-003 — Permission denied on deploy path

User **deploy** must be able to write to /opt/nimbus (group-based least privilege preferred).
Prove by writing /opt/nimbus/deployed.ok as deploy.
EOF
ok "Fix deploy permissions"
