#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE/data"
echo "nimbus asset $(date -Iseconds)" >"$WORKSPACE/data/asset.txt"
echo "orders export" >"$WORKSPACE/data/orders.csv"
aws_local s3 mb s3://nimbus-src 2>/dev/null || true
aws_local s3 mb s3://nimbus-dst 2>/dev/null || true
aws_local s3 cp "$WORKSPACE/data/asset.txt" s3://nimbus-src/asset.txt
aws_local s3 cp "$WORKSPACE/data/orders.csv" s3://nimbus-src/orders.csv
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-023 — S3 Bucket Data Migration Using AWS CLI

Migrate all objects from `s3://nimbus-src` → `s3://nimbus-dst` using AWS CLI
(sync or cp --recursive). Destination must contain the same keys.
EOF
ok "Source bucket seeded. Migrate src → dst."
