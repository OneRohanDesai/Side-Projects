#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
status=$(aws_local s3api get-bucket-versioning --bucket nimbus-versioned --query Status --output text 2>/dev/null || echo none)
if [[ "$status" == "Enabled" ]]; then ok "versioning Enabled"; else err "versioning is '$status' (want Enabled)"; exit 1; fi
