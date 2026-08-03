# Architecture

```
install.sh                 interactive / CLI entry
├── lib/
│   ├── common.sh          logging, prompts, deploy helpers
│   ├── detect.sh          distro + package manager
│   ├── packages.sh        pacman/apt/dnf/zypper/… + AUR (yay)
│   └── services.sh        systemd, groups, shell
├── modules/               ordered feature packs
│   ├── 00-base            CLI core, fonts, audio, network
│   ├── 10-shell           zsh, starship, tmux, git
│   ├── 20-desktop         i3 stack + configs + assets
│   ├── 30-devtools        Rust/Go/Node
│   ├── 40-devops          containers · k8s · IaC · GitOps (tiered)
│   ├── 41-sre             observability · load · chaos · DR (tiered)
│   ├── 50-cloud           AWS / GCP / Azure ecosystems (tiered)
│   ├── 60-security        DevSecOps arsenal (tiered)
│   ├── 70-virt            libvirt / QEMU
│   ├── 80-laptop          TLP + ThinkPad battery unit
│   └── 90-postinstall     summary + state file
├── lib/binaries.sh        GitHub releases, go/npm/pip installers
├── packages/<family>/     distro-specific package names
├── configs/               portable dotfiles (templates use @HOME@)
├── scripts/               rofi helpers, audio, themes
├── assets/                default wallpaper + notification sound
├── systemd/               optional system units
└── profiles/              named module bundles
```

## Multi-distro strategy

1. Detect `ID` / `ID_LIKE` from `/etc/os-release`.
2. Map to a package family: `arch` | `debian` | `fedora` | …
3. Install from `packages/<family>/<module>.txt`.
4. Missing packages are skipped and logged to
   `~/.local/state/baby-linux/missing-packages.txt`.
5. Cross-distro tools use **official installers** (AWS CLI, rustup, starship,
   kind, Trivy) when repos lag.

## Path layout after install

| Path | Purpose |
|------|---------|
| `~/.config/i3/` | WM config |
| `~/.config/kitty/` | Terminal |
| `~/.config/nvim/` | Editor |
| `~/Arch/Scripts` | Personal scripts (`BABY_HOME`) |
| `~/Arch/Wallpapers` | Wallpapers |
| `~/.local/bin` | PATH helpers |
| `~/.local/state/baby-linux/` | Install log + manifest |

Override home layout with `BABY_HOME=/path ./install.sh`.

## Design principles

- **Idempotent**: re-run safe; backups before overwrite.
- **No secrets in git**: templates only for identity (git name/email asked at install).
- **Public domain**: Unlicense — fork freely.
- **Interactive by default**, scriptable via `--profile` / `--modules`.
