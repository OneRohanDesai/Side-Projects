#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
aws_local iam get-user --user-name nimbus-deploy >/dev/null
ok "user nimbus-deploy exists"
