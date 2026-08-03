#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-082 — Ansible Inventory Creation for App Servers

Create inventory.ini (or hosts.yml) for the Ansible lab containers:
- group [app]: app01, app02
- group [db]: db01
- group [all:vars] with ansible_connection=docker and ansible_python_interpreter=/usr/bin/python3

Host names must match docker container names: grounds-app01, grounds-app02, grounds-db01
(or set ansible_host accordingly).
EOF
ok "Write Ansible inventory for lab hosts"
