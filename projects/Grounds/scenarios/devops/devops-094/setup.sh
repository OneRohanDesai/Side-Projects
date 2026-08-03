#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/provider.tf" <<'EOF'
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true
  endpoints {
    ec2 = "http://localhost:4566"
    s3  = "http://localhost:4566"
    iam = "http://localhost:4566"
  }
}
EOF
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-094 — VPC Creation Using Terraform

Using the provided provider.tf (LocalStack), write main.tf that creates:
- aws_vpc.nimbus with cidr 10.20.0.0/16
- tags Name=nimbus-vpc

terraform init && terraform apply -auto-approve
EOF
ok "Create VPC with Terraform against LocalStack"
