variable "project" {
  type = string
}

variable "env" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "az_count" {
  type    = number
  default = 3
}

variable "public_subnet_cidrs" {
  type = list(string)
  default = [
    "10.0.0.0/24",
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
}

variable "private_subnet_cidrs" {
  type = list(string)
  default = [
    "10.0.10.0/24",
    "10.0.11.0/24",
    "10.0.12.0/24"
  ]
}

variable "observability_subnet_cidrs" {
  type = list(string)
  default = [
    "10.0.20.0/24",
    "10.0.21.0/24",
    "10.0.22.0/24"
  ]
}

variable "enable_nat" {
  type    = bool
  default = true
}

