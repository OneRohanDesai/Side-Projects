variable "hcloud_token" {
  description = "Hetzner Cloud API Token"
  type        = string
  sensitive   = true
}

variable "server_name" {
  type    = string
  default = "telemetry-playground"
}

variable "server_type" {
  type    = string
  default = "cx22"
}

variable "location" {
  type    = string
  default = "nbg1"
}

variable "image" {
  type    = string
  default = "ubuntu-24.04"
}

variable "ssh_key_name" {
  description = "Existing SSH Key uploaded to Hetzner"
  type        = string
}
