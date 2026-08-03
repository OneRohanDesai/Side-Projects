#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# seed inventory if missing
if [[ ! -f "$WORKSPACE/inventory.ini" ]]; then
  cat >"$WORKSPACE/inventory.ini" <<'INV'
[app]
grounds-app01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
grounds-app02 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
[db]
grounds-db01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
INV
fi
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-086 — Ansible Ping Module Usage

Run ansible ping against all inventory hosts and save output to ping.txt.
All three hosts must respond pong.
EOF
ok "Ping all ansible lab hosts"
