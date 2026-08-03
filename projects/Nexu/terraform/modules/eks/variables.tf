variable "project"        { type = string }
variable "env"            { type = string }
variable "aws_region"     { type = string }

variable "vpc_id"         { type = string }
variable "private_subnets" { type = list(string) }
variable "eks_sg_id"      { type = string }

variable "node_instance_type" {
  type    = string
  default = "m5.large"
}

variable "desired_capacity" {
  type    = number
  default = 2
}

variable "max_capacity" {
  type    = number
  default = 3
}

variable "min_capacity" {
  type    = number
  default = 1
}

variable "enable_fargate" {
  type    = bool
  default = true
}
