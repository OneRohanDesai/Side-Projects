#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
inv=""
for f in inventory.ini hosts.ini inventory.yml hosts.yml inventory.yaml; do
  [[ -f "$WORKSPACE/$f" ]] && inv="$WORKSPACE/$f" && break
done
[[ -n "$inv" ]] || { err "no inventory file"; exit 1; }
ok "inventory: $inv"
# parse with ansible-inventory if possible
if command -v ansible-inventory >/dev/null; then
  ansible-inventory -i "$inv" --list >/tmp/grounds-inv.json
  jq -e '.app.children // .app.hosts // .all.children.app' /tmp/grounds-inv.json >/dev/null 2>&1 \
    || jq -e 'keys' /tmp/grounds-inv.json >/dev/null
  ok "ansible-inventory parses file"
fi
grep -qE 'app01|grounds-app01' "$inv" && ok "app hosts listed" || { err "app hosts missing"; exit 1; }
