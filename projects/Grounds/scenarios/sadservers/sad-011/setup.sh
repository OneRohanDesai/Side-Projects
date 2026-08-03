#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  iptables -F || true
  iptables -P INPUT DROP
  iptables -P FORWARD DROP
  iptables -P OUTPUT ACCEPT
  iptables -A INPUT -i lo -j ACCEPT
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT
  # forgot established, forgot 80
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-011 — Half-open firewall

iptables DROP policy broke web and established connections.
Restore safe rules allowing:
- lo
- established/related
- 22, 80, 443
Keep default policy reasonably secure.
EOF
ok "Fix iptables in linux lab"
