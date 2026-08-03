#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-042 — NoSQL Database Management with DynamoDB

Create DynamoDB table **nimbus-orders**:
- Partition key: order_id (S)
- Sort key: created_at (S)  [optional but preferred]
- Billing mode: PAY_PER_REQUEST

Put at least 2 sample order items, then query/scan and save to scan.json.
EOF
ok "Create DynamoDB table nimbus-orders"
