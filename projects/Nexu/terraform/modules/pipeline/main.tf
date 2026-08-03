variable "project" {}
variable "env" {}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_ecr_repository" "repo" {
  name = "${var.project}-${var.env}"
}

resource "aws_iam_role" "codebuild_build_role" {
  name = "${var.project}-${var.env}-build-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "codebuild_build_policy" {
  role = aws_iam_role.codebuild_build_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["ecr:*", "logs:*", "s3:*"],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "codebuild_deploy_role" {
  name = "${var.project}-${var.env}-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

resource "aws_iam_role_policy" "codebuild_deploy_policy" {
  role = aws_iam_role.codebuild_deploy_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "eks:*",
          "ecr:*",
          "iam:PassRole",
          "logs:*",
          "s3:*"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_codebuild_project" "build" {
  name          = "${var.project}-${var.env}-build"
  service_role  = aws_iam_role.codebuild_build_role.arn
  artifacts { type = "CODEPIPELINE" }
  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"
    privileged_mode = true
  }
  source { type = "CODEPIPELINE" }
}

resource "aws_codebuild_project" "deploy" {
  name          = "${var.project}-${var.env}-deploy"
  service_role  = aws_iam_role.codebuild_deploy_role.arn
  artifacts { type = "CODEPIPELINE" }
  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"
    privileged_mode = true
  }
  source { type = "CODEPIPELINE" }
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project}-${var.env}-pipeline-artifacts"
}

resource "aws_codepipeline" "pipeline" {
  name     = "${var.project}-${var.env}-pipeline"
  role_arn = aws_iam_role.codebuild_build_role.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"
    action {
      name = "Source"
      category = "Source"
      owner = "AWS"
      provider = "CodeStarSourceConnection"
      version = "1"
      output_artifacts = ["source_output"]
      configuration = {
        ConnectionArn = var.connection_arn
        FullRepositoryId = var.repo_id
        BranchName     = "central"
      }
    }
  }

  stage {
    name = "Build"
    action {
      name      = "Build"
      category  = "Build"
      owner     = "AWS"
      provider  = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }

  stage {
    name = "Deploy"
    action {
      name      = "DeployToEKS"
      category  = "Build"
      owner     = "AWS"
      provider  = "CodeBuild"
      input_artifacts = ["build_output"]
      configuration = {
        ProjectName = aws_codebuild_project.deploy.name
      }
    }
  }
}

