output "server_name" {
  value = hcloud_server.telemetry.name
}

output "ipv4" {
  value = hcloud_server.telemetry.ipv4_address
}

output "ipv6" {
  value = hcloud_server.telemetry.ipv6_address
}

output "ssh" {
  value = "ssh root@${hcloud_server.telemetry.ipv4_address}"
}
