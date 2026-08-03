#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
sg=$(aws_local ec2 describe-security-groups --filters Name=tag:Name,Values=nimbus-web-sg-tf --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
[[ "$sg" != "None" && -n "$sg" ]] && ok "sg $sg" || {
  # fallback group name
  sg=$(aws_local ec2 describe-security-groups --filters Name=group-name,Values=nimbus-web-sg-tf --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
  [[ "$sg" != "None" && -n "$sg" ]] && ok "sg $sg" || { err "security group not found"; exit 1; }
}
