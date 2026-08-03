#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'sudo -u deploy test -w /opt/nimbus && sudo -u deploy touch /opt/nimbus/deployed.ok' \
  && ok "deploy can write" || { err "deploy cannot write /opt/nimbus"; exit 1; }
