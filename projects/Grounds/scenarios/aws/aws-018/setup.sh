#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
# ensure user exists from path
aws_local iam create-user --user-name nimbus-readonly 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-018 — Read-Only IAM Policy for EC2 Access

Create a customer-managed policy named **NimbusEC2ReadOnly** that allows only:
- ec2:Describe*
- ec2:List*

Attach it to user `nimbus-readonly`.
Save policy ARN to policy-arn.txt.
EOF
ok "User nimbus-readonly ready — create and attach read-only EC2 policy"
