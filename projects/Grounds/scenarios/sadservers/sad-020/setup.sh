#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/inventory.ini" <<'INV'
[app]
grounds-app01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
grounds-app02 ansible_connection=ssh ansible_host=127.0.0.1 ansible_port=22 ansible_user=nobody
grounds-missing ansible_connection=docker
INV
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-020 — Ansible unreachable hosts

inventory.ini has broken entries. Fix it so `ansible -i inventory.ini app -m ping`
succeeds for app01 and app02 (docker connection to grounds-app01/02).
Remove bogus hosts.
EOF
ok "Fix ansible inventory reachability"
