output "cluster_name"       { value = aws_eks_cluster.main.name }
output "cluster_endpoint"   { value = aws_eks_cluster.main.endpoint }
output "cluster_role_arn"   { value = aws_iam_role.eks_cluster_role.arn }
output "node_role_arn"      { value = aws_iam_role.eks_node_role.arn }
output "ecr_repos"          { value = [for r in aws_ecr_repository.repos : r.repository_url] }
