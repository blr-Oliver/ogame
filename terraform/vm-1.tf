resource "digitalocean_droplet" "vm-1" {
  image = "ubuntu-20-04-x64"
  name = "vm-1"
  region = "lon1"
  size = "s-1vcpu-1gb"
  ssh_keys = [
    data.digitalocean_ssh_key.default.id
  ]

  connection {
    host = self.ipv4_address
    user = "root"
    type = "ssh"
    private_key = file(var.do_pvt_key)
    timeout = "2m"
  }
}

