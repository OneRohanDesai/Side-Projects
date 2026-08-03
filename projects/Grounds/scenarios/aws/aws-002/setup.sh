#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-002 — Security Group Configuration

Create a security group named **nimbus-web-sg** that:
- Description: "Nimbus web tier"
- Allows inbound TCP 80 and 443 from 0.0.0.0/0
- Allows inbound TCP 22 from 10.0.0.0/8
- Allows all outbound

Write the GroupId to `sg-id.txt`.
EOF
ok "Create security group nimbus-web-sg"
