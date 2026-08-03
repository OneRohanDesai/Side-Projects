#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
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
  endpoints {
    ec2 = "http://localhost:4566"
    iam = "http://localhost:4566"
  }
}
EOF
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-096 — EC2 Instance Deployment Using Terraform

Create an aws_instance.nimbus with:
- ami = "ami-nimbus" (LocalStack accepts fake AMIs)
- instance_type = "t3.micro"
- tags Name=nimbus-ec2

Note: LocalStack EC2 is limited but create should succeed.
EOF
ok "Terraform an EC2 instance on LocalStack"
