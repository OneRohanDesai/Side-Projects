#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
st=$(aws_local cloudformation describe-stacks --stack-name nimbus-starter --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo MISSING)
echo "$st" | grep -qE 'CREATE_COMPLETE|UPDATE_COMPLETE' && ok "stack $st" || { err "stack status: $st"; fail=1; }
aws_local s3 ls s3://nimbus-cfn-assets >/dev/null 2>&1 && ok "bucket exists" || { err "bucket nimbus-cfn-assets missing"; fail=1; }
aws_local sqs get-queue-url --queue-name nimbus-cfn-jobs >/dev/null 2>&1 && ok "queue exists" || { err "queue missing"; fail=1; }
exit $fail
