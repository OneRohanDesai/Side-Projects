#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-001 — AWS Key Pair Creation

Create an EC2 key pair named **nimbus-key** in LocalStack.

## Constraints
- Name must be exactly `nimbus-key`
- Save the private key material to `nimbus-key.pem` in this workspace
- chmod 400 the pem file

## Hints
```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
aws ec2 create-key-pair --key-name nimbus-key --query 'KeyMaterial' --output text > nimbus-key.pem
```
EOF
ok "Workspace ready. Create key pair nimbus-key against LocalStack."
