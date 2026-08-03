#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
url=$(aws_local sqs get-queue-url --queue-name nimbus-jobs --query QueueUrl --output text)
count=$(aws_local sqs get-queue-attributes --queue-url "$url" --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)
[[ "${count:-1}" == "0" ]] && ok "queue drained" || { err "still $count messages"; exit 1; }
