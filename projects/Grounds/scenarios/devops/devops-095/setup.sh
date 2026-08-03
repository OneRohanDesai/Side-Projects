#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
# reuse provider if student runs sequentially
if [[ ! -f "$WORKSPACE/provider.tf" ]]; then
  cp "${GROUNDS_ROOT}/scenarios/devops/devops-094/../devops-094/provider.tf" "$WORKSPACE/provider.tf" 2>/dev/null || true
fi
if [[ ! -f "$WORKSPACE/provider.tf" ]]; then
  cat >"$WORKSPACE/provider.tf" <<'EOF'
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}
provider "aws" {
  region = "us-east-1"
  access_key = "test"
  secret_key = "test"
  skip_credentials_validation = true
  skip_metadata_api_check = true
  skip_requesting_account_id = true
  endpoints { ec2 = "http://localhost:4566" }
}
EOF
fi
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-095 — Security Group Configuration with Terraform

Create aws_security_group.nimbus_web allowing ingress 80/443 from 0.0.0.0/0.
Tag Name=nimbus-web-sg-tf
EOF
ok "Terraform a security group on LocalStack"
