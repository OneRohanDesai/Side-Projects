output "vpc_id"                { value = aws_vpc.main.id }
output "public_subnets"        { value = aws_subnet.public[*].id }
output "private_subnets"       { value = aws_subnet.private[*].id }
output "observability_subnets" { value = aws_subnet.observability[*].id }
output "eks_sg_id"             { value = aws_security_group.eks_nodes.id }
output "alb_sg_id"             { value = aws_security_group.alb.id }
