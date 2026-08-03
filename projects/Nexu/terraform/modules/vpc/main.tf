data "aws_availability_zones" "available" {}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name    = "${var.project}-${var.env}-vpc"
    Project = var.project
    Env     = var.env
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${var.project}-${var.env}-igw"
  }
}

resource "aws_subnet" "public" {
  count             = var.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.project}-${var.env}-public-${count.index + 1}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags = {
    Name = "${var.project}-${var.env}-private-${count.index + 1}"
    Tier = "private"
  }
}

resource "aws_subnet" "observability" {
  count             = var.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.observability_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags = {
    Name = "${var.project}-${var.env}-obs-${count.index + 1}"
    Tier = "observability"
  }
}

resource "aws_eip" "nat" {
  count = var.enable_nat ? var.az_count : 0
  domain = "vpc"
  tags = {
    Name = "${var.project}-${var.env}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "nat" {
  count         = var.enable_nat ? var.az_count : 0
  subnet_id     = element(aws_subnet.public[*].id, count.index)
  allocation_id = aws_eip.nat[count.index].id
  tags = {
    Name = "${var.project}-${var.env}-nat-${count.index + 1}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "${var.project}-${var.env}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = element(aws_subnet.public[*].id, count.index)
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count = var.az_count
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = element(aws_nat_gateway.nat[*].id, count.index)
  }
  tags = { Name = "${var.project}-${var.env}-private-rt-${count.index + 1}" }
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = element(aws_subnet.private[*].id, count.index)
  route_table_id = element(aws_route_table.private[*].id, count.index)
}

resource "aws_route_table" "observability" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "${var.project}-${var.env}-obs-rt" }
}

resource "aws_route_table_association" "observability" {
  count          = var.az_count
  subnet_id      = element(aws_subnet.observability[*].id, count.index)
  route_table_id = aws_route_table.observability.id
}

resource "aws_security_group" "eks_nodes" {
  name        = "${var.project}-${var.env}-eks-nodes"
  description = "EKS node security group"
  vpc_id      = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project}-${var.env}-eks-nodes" }
}

resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.env}-alb"
  description = "Allow inbound HTTP/HTTPS to ALB"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project}-${var.env}-alb" }
}
