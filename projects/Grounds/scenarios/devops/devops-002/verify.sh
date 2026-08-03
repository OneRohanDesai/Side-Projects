#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab id tempuser >/dev/null
exp=$(docker exec grounds-linux-lab chage -l tempuser | grep -i 'Account expires' || true)
echo "$exp" | grep -viq 'never' && ok "expiry set: $exp" || { err "account expires should not be never"; exit 1; }
