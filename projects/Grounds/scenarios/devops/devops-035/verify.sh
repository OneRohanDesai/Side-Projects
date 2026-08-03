#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker info >/dev/null && ok "docker daemon ok" || { err "docker down"; fail=1; }
docker inspect grounds-hello >/dev/null 2>&1 && ok "container exists" || { err "grounds-hello missing"; fail=1; }
state=$(docker inspect -f '{{.State.Running}}' grounds-hello 2>/dev/null || echo false)
[[ "$state" == "true" ]] && ok "running" || { err "not running"; fail=1; }
exit $fail
