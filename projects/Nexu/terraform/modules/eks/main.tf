resource "aws_ecr_repository" "repos" {
  for_each = toset(["ffmpeg-streamer", "icecast-radio", "locust-load"])

  name                 = "${var.project}-${var.env}-${each.key}"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = {
    Project = var.project
    Env     = var.env
  }
}

data "aws_iam_policy_document" "eks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_cluster_role" {
  name               = "${var.project}-${var.env}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_assume_role.json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_AmazonEKSClusterPolicy" {
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

data "aws_iam_policy_document" "node_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_node_role" {
  name               = "${var.project}-${var.env}-eks-node-role"
  assume_role_policy = data.aws_iam_policy_document.node_assume_role.json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_iam_role_policy_attachment" "node_AmazonEKSWorkerNodePolicy" {
  role       = aws_iam_role.eks_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_AmazonEC2ContainerRegistryReadOnly" {
  role       = aws_iam_role.eks_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "node_AmazonEKS_CNI_Policy" {
  role       = aws_iam_role.eks_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_eks_cluster" "main" {
  name     = "${var.project}-${var.env}-eks"
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids         = var.private_subnets
    security_group_ids = [var.eks_sg_id]
  }

  tags = {
    Project = var.project
    Env     = var.env
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_AmazonEKSClusterPolicy
  ]
}

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project}-${var.env}-node-group"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = var.private_subnets

  scaling_config {
    desired_size = var.desired_capacity
    max_size     = var.max_capacity
    min_size     = var.min_capacity
  }

  instance_types = [var.node_instance_type]

  tags = {
    Project = var.project
    Env     = var.env
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_AmazonEC2ContainerRegistryReadOnly,
    aws_iam_role_policy_attachment.node_AmazonEKS_CNI_Policy,
    aws_eks_cluster.main
  ]
}

data "aws_iam_policy_document" "fargate_assume_role" {
  count = var.enable_fargate ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks-fargate-pods.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "fargate_pod_execution_role" {
  count              = var.enable_fargate ? 1 : 0
  name               = "${var.project}-${var.env}-fargate-pod-role"
  assume_role_policy = data.aws_iam_policy_document.fargate_assume_role[0].json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_iam_role_policy_attachment" "fargate_execution_policy" {
  count      = var.enable_fargate ? 1 : 0
  role       = aws_iam_role.fargate_pod_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy"
}

resource "aws_eks_fargate_profile" "fp" {
  count                  = var.enable_fargate ? 1 : 0
  cluster_name           = aws_eks_cluster.main.name
  fargate_profile_name   = "${var.project}-${var.env}-fp"
  pod_execution_role_arn = aws_iam_role.fargate_pod_execution_role[0].arn
  subnet_ids             = var.private_subnets

  selector {
    namespace = "default"
  }

  depends_on = [
    aws_iam_role_policy_attachment.fargate_execution_policy,
    aws_eks_cluster.main
  ]
}
