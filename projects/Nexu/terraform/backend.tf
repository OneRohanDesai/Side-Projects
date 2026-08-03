terraform {
  backend "s3" {
    bucket         = "nexu-demo-terraform-state-2025-11-13"
    key            = "nexu/demo/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "nexu-demo-tf-locks"
    encrypt        = true
  }
}

