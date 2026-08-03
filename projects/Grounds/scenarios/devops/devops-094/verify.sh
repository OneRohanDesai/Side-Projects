#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
[[ -f "$WORKSPACE/main.tf" || -f "$WORKSPACE/vpc.tf" ]] && ok "tf files present" || { err "main.tf missing"; fail=1; }
# check via AWS API
vpcs=$(aws_local ec2 describe-vpcs --filters Name=tag:Name,Values=nimbus-vpc --query 'Vpcs[].VpcId' --output text 2>/dev/null || true)
if [[ -z "$vpcs" || "$vpcs" == "None" ]]; then
  # also accept cidr match
  vpcs=$(aws_local ec2 describe-vpcs --query 'Vpcs[?CidrBlock==`10.20.0.0/16`].VpcId' --output text 2>/dev/null || true)
fi
[[ -n "$vpcs" && "$vpcs" != "None" ]] && ok "vpc exists: $vpcs" || { err "vpc not found"; fail=1; }
exit $fail
