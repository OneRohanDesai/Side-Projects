#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
status=$(aws_local dynamodb describe-table --table-name nimbus-orders --query 'Table.TableStatus' --output text)
[[ "$status" == "ACTIVE" ]] && ok "table ACTIVE" || { err "table status $status"; exit 1; }
count=$(aws_local dynamodb scan --table-name nimbus-orders --select COUNT --query Count --output text)
if [[ "${count:-0}" -ge 2 ]]; then ok "items: $count"; else err "need >=2 items (have $count)"; exit 1; fi
