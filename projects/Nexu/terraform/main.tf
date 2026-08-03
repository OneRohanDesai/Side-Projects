module "vpc" {
  source     = "./modules/vpc"
  project    = "nexu"
  env        = "demo"
  aws_region = "ap-south-1"
}

module "eks" {
  source          = "./modules/eks"
  project         = "nexu"
  env             = "demo"
  aws_region      = "ap-south-1"
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets
  eks_sg_id       = module.vpc.eks_sg_id
}

module "alerting" {
  source  = "./modules/alerting"
  project = "nexu"
  env     = "demo"
}

module "pipeline" {
  source      = "./modules/pipeline"
  project     = "nexu"
  env         = "demo"
  repo_id     = "ladybug/Nexu"
  connection_arn = "<AWS Codestar connection ARN>"
}
