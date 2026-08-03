#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
state=$(docker inspect -f '{{.State.Running}}' grounds-sad-loop 2>/dev/null || echo false)
[[ "$state" == "true" ]] && ok "running" || { err "not running"; exit 1; }
restarts=$(docker inspect -f '{{.RestartCount}}' grounds-sad-loop)
# after fix restart count may be high but should be stable — check not exiting
sleep 2
state2=$(docker inspect -f '{{.State.Running}}' grounds-sad-loop)
[[ "$state2" == "true" ]] && ok "still running" || { err "still crashing"; exit 1; }
