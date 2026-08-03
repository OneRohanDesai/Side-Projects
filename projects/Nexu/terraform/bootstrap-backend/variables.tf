variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "nexu"
}

variable "env" {
  type    = string
  default = "demo"
}

variable "tf_state_bucket_name" {
  type        = string
  description = "Name for the S3 bucket that will hold Terraform state. Must be globally unique."
  default     = ""
}

variable "dynamodb_table_name" {
  type    = string
  default = ""
}

variable "enable_kms" {
  type    = bool
  default = true
}

