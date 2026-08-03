#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
ids=$(aws_local ec2 describe-instances --filters Name=tag:Name,Values=nimbus-ec2 --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || true)
[[ -n "$ids" && "$ids" != "None" ]] && ok "instance $ids" || { err "instance not found"; exit 1; }
