# Fresh Linux install guide

This repo assumes a **working base system** already exists:

- Disks partitioned, bootloader (GRUB/systemd-boot) working
- Network online
- `sudo` (or root) available
- `git` available (or download a release tarball)

## Arch Linux (recommended path)

1. Install Arch following the [Installation guide](https://wiki.archlinux.org/title/Installation_guide).
2. Create your user, enable NetworkManager, install `git` + `sudo`.
3. Log in as that user (TTY is fine).
4. Clone and run:

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git ~/Baby-Linux
cd ~/Baby-Linux
./install.sh
```

5. Choose **Full** (or `./install.sh --profile full`).
6. Reboot, pick **i3** at SDDM.

### Minimal Arch pre-flight (optional)

```bash
# as root, before cloning
pacman -Syu --needed git sudo networkmanager
systemctl enable --now NetworkManager
useradd -m -G wheel YOURUSER
passwd YOURUSER
EDITOR=nvim visudo   # uncomment %wheel ALL=(ALL:ALL) ALL
```

## Debian / Ubuntu

```bash
sudo apt update && sudo apt install -y git curl
git clone https://github.com/OneRohanDesai/Baby-Linux.git ~/Baby-Linux
cd ~/Baby-Linux
./install.sh --profile full
```

Some DevOps packages (latest kubectl/terraform) may need HashiCorp/Kubernetes
repos; the installer installs distro versions where available and falls back to
binaries for tools like `kind` / `k9s` / cloud CLIs.

## Fedora

```bash
sudo dnf install -y git curl
git clone https://github.com/OneRohanDesai/Baby-Linux.git ~/Baby-Linux
cd ~/Baby-Linux
./install.sh --profile full
```

## Headless DevOps server

```bash
./install.sh --profile devops -y
```

Skips i3/SDDM; still installs Docker, k8s tools, Terraform, cloud CLIs, etc.

## After install — secrets you must restore yourself

This repo **never** ships:

| Item | Typical location |
|------|------------------|
| SSH keys | `~/.ssh/` |
| GPG keys | `~/.gnupg/` |
| kubeconfigs | `~/.kube/` |
| Cloud credentials | `~/.aws/`, `~/.config/gcloud/`, `~/.azure/` |
| API tokens | env files, password manager |

## Keybindings (i3)

| Keys | Action |
|------|--------|
| Super+Return | Kitty terminal |
| Super+d | Rofi app launcher |
| Super+Shift+e | Power menu |
| Super+Escape | Lock |
| Super+q | Kill window |
| Super+1..0 | Workspaces |
| Print | Flameshot |

## Updating

```bash
cd ~/Baby-Linux && git pull
./install.sh --modules shell,desktop
```

Re-running is safe: existing files are backed up as `*.bak.<timestamp>` before overwrite.
