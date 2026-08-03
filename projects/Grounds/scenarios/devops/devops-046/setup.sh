#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-046 — Application Deployment Using Docker Containers

Deploy the Nimbus production stack (or confirm it) and place a real order:

1. Ensure API health is ok at http://localhost:8080/health
2. POST an order for customer "devops-046" with product_id 1 qty 1
3. Save the JSON response to order.json in this workspace
EOF
ok "Deploy/use Nimbus and place an order"
