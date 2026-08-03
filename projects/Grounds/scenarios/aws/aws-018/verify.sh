#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
pols=$(aws_local iam list-policies --scope Local --query 'Policies[?PolicyName==`NimbusEC2ReadOnly`].Arn' --output text)
if [[ -z "$pols" ]]; then err "policy NimbusEC2ReadOnly not found"; exit 1; fi
ok "policy exists: $pols"
attached=$(aws_local iam list-attached-user-policies --user-name nimbus-readonly --query 'AttachedPolicies[].PolicyName' --output text)
echo "$attached" | tr '\t' '\n' | grep -qx NimbusEC2ReadOnly && ok "attached to nimbus-readonly" || { err "not attached"; fail=1; }
exit $fail
