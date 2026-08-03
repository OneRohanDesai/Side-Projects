#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
# Find SG by name (LocalStack may use default VPC)
sg_json=$(aws_local ec2 describe-security-groups --filters Name=group-name,Values=nimbus-web-sg --output json 2>/dev/null || echo '{"SecurityGroups":[]}')
count=$(echo "$sg_json" | jq '.SecurityGroups|length')
if [[ "$count" -lt 1 ]]; then err "security group nimbus-web-sg not found"; exit 1; fi
ok "security group exists"
perms=$(echo "$sg_json" | jq -c '.[0].IpPermissions // .SecurityGroups[0].IpPermissions')
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==80 and .ToPort==80)' >/dev/null \
  && ok "ingress :80" || { err "missing ingress tcp/80"; fail=1; }
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==443 and .ToPort==443)' >/dev/null \
  && ok "ingress :443" || { err "missing ingress tcp/443"; fail=1; }
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==22)' >/dev/null \
  && ok "ingress :22" || { err "missing ingress tcp/22"; fail=1; }
if [[ -f "$WORKSPACE/sg-id.txt" ]]; then ok "sg-id.txt present"; else warn "sg-id.txt missing (optional but recommended)"; fi
exit $fail
