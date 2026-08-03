#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local s3 ls s3://nimbus-static/index.html >/dev/null 2>&1 && ok "index.html uploaded" || { err "index.html missing"; fail=1; }
cfg=$(aws_local s3api get-bucket-website --bucket nimbus-static 2>/dev/null || echo '{}')
echo "$cfg" | jq -e '.IndexDocument.Suffix == "index.html"' >/dev/null && ok "website hosting configured" || { err "website config missing"; fail=1; }
exit $fail
