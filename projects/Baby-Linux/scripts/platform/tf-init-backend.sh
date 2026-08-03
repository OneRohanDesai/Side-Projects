#!/usr/bin/env bash
# Helper scaffold for Terraform remote state (S3 + DynamoDB OR GCS OR Azure)
set -euo pipefail

PROVIDER="${1:-}"
if [[ -z "$PROVIDER" ]]; then
  echo "Usage: $0 <aws|gcp|azure> [bucket/name]"
  exit 1
fi

case "$PROVIDER" in
  aws)
    BUCKET="${2:-my-tf-state}"
    cat <<EOF
# backend.tf — AWS
terraform {
  backend "s3" {
    bucket         = "${BUCKET}"
    key            = "env/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "${BUCKET}-lock"
    encrypt        = true
  }
}
# Create once:
# aws s3api create-bucket --bucket ${BUCKET} --region us-east-1
# aws dynamodb create-table --table-name ${BUCKET}-lock \\
#   --attribute-definitions AttributeName=LockID,AttributeType=S \\
#   --key-schema AttributeName=LockID,KeyType=HASH \\
#   --billing-mode PAY_PER_REQUEST
EOF
    ;;
  gcp)
    BUCKET="${2:-my-tf-state}"
    cat <<EOF
# backend.tf — GCS
terraform {
  backend "gcs" {
    bucket = "${BUCKET}"
    prefix = "env/terraform"
  }
}
# gsutil mb -l us-central1 gs://${BUCKET}
# gsutil versioning set on gs://${BUCKET}
EOF
    ;;
  azure)
    cat <<EOF
# backend.tf — Azure Storage
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "tfstateacct"
    container_name       = "tfstate"
    key                  = "env.terraform.tfstate"
  }
}
EOF
    ;;
  *)
    echo "Unknown provider: $PROVIDER"
    exit 1
    ;;
esac
