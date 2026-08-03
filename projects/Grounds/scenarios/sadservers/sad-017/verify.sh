#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
attached=$(aws_local iam list-attached-user-policies --user-name nimbus-app --query 'AttachedPolicies[].PolicyName' --output text 2>/dev/null || true)
inline=$(aws_local iam list-user-policies --user-name nimbus-app --query 'PolicyNames' --output text 2>/dev/null || true)
if [[ -n "$attached" || -n "$inline" ]]; then ok "user has policy ($attached $inline)"; else err "no policy on nimbus-app"; exit 1; fi
