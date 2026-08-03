#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
for key in asset.txt orders.csv; do
  if aws_local s3 ls "s3://nimbus-dst/$key" >/dev/null 2>&1; then ok "dst has $key"
  else err "missing s3://nimbus-dst/$key"; fail=1; fi
done
exit $fail
