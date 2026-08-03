locals {
  project   = var.project
  env       = var.env
  timestamp = formatdate("YYYYMMDD", timestamp())

  bucket_name = length(trim(var.tf_state_bucket_name, " ")) > 0 ? var.tf_state_bucket_name : "${local.project}-${local.env}-tfstate-${local.timestamp}"
  ddb_name    = length(trim(var.dynamodb_table_name, " ")) > 0 ? var.dynamodb_table_name : "${local.project}-${local.env}-tf-locks"
}

resource "aws_kms_key" "tf_state" {
  count                   = var.enable_kms ? 1 : 0
  description             = "KMS key to encrypt Terraform remote state for ${local.project}/${local.env}"
  deletion_window_in_days = 30

  tags = {
    Project   = local.project
    Env       = local.env
    ManagedBy = "terraform"
  }
}

resource "aws_kms_alias" "tf_state_alias" {
  count         = var.enable_kms ? 1 : 0
  name          = "alias/${local.project}-${local.env}-tfstate"
  target_key_id = aws_kms_key.tf_state[0].key_id
}

resource "aws_s3_bucket" "tf_state" {
  bucket = local.bucket_name
  acl    = "private"

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = var.enable_kms ? aws_kms_key.tf_state[0].arn : null
        sse_algorithm     = var.enable_kms ? "aws:kms" : "AES256"
      }
    }
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    id      = "retain-state-90days"
    enabled = true
    noncurrent_version_expiration {
      days = 90
    }
  }

  tags = {
    Name    = local.bucket_name
    Project = local.project
    Env     = local.env
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state_block" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_locks" {
  name         = local.ddb_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Project = local.project
    Env     = local.env
  }
}

output "tf_state_bucket" {
  value = aws_s3_bucket.tf_state.bucket
}

output "tf_state_bucket_arn" {
  value = aws_s3_bucket.tf_state.arn
}

output "tf_lock_table" {
  value = aws_dynamodb_table.tf_locks.name
}

output "kms_key_arn" {
  value = var.enable_kms ? aws_kms_key.tf_state[0].arn : ""
}

