#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker exec grounds-linux-lab id amanda >/dev/null 2>&1 || { err "user amanda missing"; exit 1; }
shell=$(docker exec grounds-linux-lab getent passwd amanda | cut -d: -f7)
echo "$shell" | grep -qE 'nologin|false' && ok "shell=$shell" || { err "shell should be nologin (got $shell)"; fail=1; }
home=$(docker exec grounds-linux-lab getent passwd amanda | cut -d: -f6)
docker exec grounds-linux-lab test -d "$home" && ok "home $home" || { err "home missing"; fail=1; }
exit $fail
