resource "hcloud_firewall" "telemetry" {

  name = "telemetry-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "out"
    protocol   = "tcp"
    port       = "1-65535"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction = "out"
    protocol  = "udp"
    port      = "1-65535"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction = "out"
    protocol  = "icmp"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "telemetry" {

  name        = var.server_name
  server_type = var.server_type
  image       = var.image
  location    = var.location

  ssh_keys = [
    var.ssh_key_name
  ]

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}

resource "hcloud_firewall_attachment" "telemetry" {

  firewall_id = hcloud_firewall.telemetry.id

  server_ids = [
    hcloud_server.telemetry.id
  ]
}
