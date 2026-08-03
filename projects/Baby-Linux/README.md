# Baby Linux

**One clone. One script. Your entire Linux workstation.**

Public-domain bootstrap for **Arch** (primary) and other Linux distros
(Debian/Ubuntu, Fedora, …). Built for **DevOps · Cloud (AWS/GCP/Azure) · SRE · DevSecOps**
— curated from a real ThinkPad Arch + i3 setup.

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
chmod +x install.sh
./install.sh --help          # see all options
./install.sh                 # interactive (recommended first run)
```

![terminal-first](https://img.shields.io/badge/UI-i3%20%2B%20kitty-blue)
![multi-distro](https://img.shields.io/badge/distros-Arch%20%7C%20Debian%20%7C%20Fedora-green)
![license](https://img.shields.io/badge/license-Unlicense-lightgrey)

---

## Table of contents

1. [Clone & prerequisites](#clone--prerequisites)
2. [Command cheat sheet](#command-cheat-sheet)
3. [All `install.sh` flags](#all-installsh-flags)
4. [Profiles (`--profile`)](#profiles---profile)
5. [Modules (`--modules`)](#modules---modules)
6. [Environment variables](#environment-variables)
7. [Tool depth tiers](#tool-depth-tiers-devops--sre--cloud--security)
8. [Failure handling](#failure-handling)
9. [Ready-to-copy examples](#ready-to-copy-examples)
10. [After install](#after-install)
11. [What gets installed](#what-gets-installed)
12. [Uninstall](#uninstall)
13. [Docs & layout](#docs--layout)
14. [License](#license)

---

## Clone & prerequisites

### Prerequisites (any distro)

| Need | Notes |
|------|--------|
| Working base OS | Disks, bootloader, network already set up |
| User with `sudo` | Or run as root (not ideal) |
| `git` + `curl` | On Arch: `sudo pacman -S git curl` |
| Internet | Packages + GitHub binary releases |

### Clone

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
chmod +x install.sh uninstall.sh
```

### Discover options anytime

```bash
./install.sh --help
./install.sh --list-profiles
./install.sh --list-modules
./install.sh --dry-run --profile full    # detect OS + show plan, install nothing
```

---

## Command cheat sheet

| Goal | Command |
|------|---------|
| Interactive wizard | `./install.sh` |
| Show help | `./install.sh --help` |
| List profiles | `./install.sh --list-profiles` |
| List modules | `./install.sh --list-modules` |
| Plan only (no install) | `./install.sh --dry-run --profile full` |
| Full laptop (desktop + tools) | `./install.sh --profile full` |
| Full laptop, fewer prompts | `./install.sh --profile full -y` |
| Headless DevOps/SRE | `./install.sh --profile devops -y` |
| Platform engineer (advanced) | `./install.sh --profile platform -y` |
| Maximum tool depth | `./install.sh --profile extreme -y` |
| CLI only (shell + base) | `./install.sh --profile minimal` |
| Laptop power + full stack | `./install.sh --profile laptop` |
| Only desktop configs | `./install.sh --modules desktop,shell` |
| Only platform stack | `./install.sh --modules devops,sre,cloud,security` |
| Only cloud CLIs | `./install.sh --modules cloud` |
| Only DevSecOps tools | `./install.sh --modules security` |
| Extreme depth, selected modules | `BABY_DEFAULT_TIER=extreme ./install.sh --modules devops,sre,cloud,security -y` |
| Auto-retry once on fail, then skip | `BABY_ON_FAIL=retry_once ./install.sh --profile devops -y` |
| Stop entire install on first fail | `BABY_ON_FAIL=abort ./install.sh --profile full -y` |
| Install binaries to `~/.local/bin` | `BABY_SYSTEM_BINS=0 ./install.sh --modules devops -y` |
| Force re-download tools | `BABY_FORCE_REINSTALL=1 ./install.sh --modules devops -y` |
| Custom Scripts/Wallpapers home | `BABY_HOME=$HOME/Arch ./install.sh --modules desktop` |

---

## All `install.sh` flags

```text
./install.sh [OPTIONS]
```

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Print help and exit |
| `--profile NAME` | `-p` | Use a preset profile (see [Profiles](#profiles---profile)) |
| `--modules LIST` | `-m` | Comma-separated modules only (see [Modules](#modules---modules)) |
| `--yes` | `-y` | Non-interactive: accept defaults; tool tier defaults to **advanced** (override with `BABY_DEFAULT_TIER`); on failure auto-**skip** (override with `BABY_ON_FAIL`) |
| `--dry-run` | | Detect distro/package manager, print plan, **do not install** |
| `--list-modules` | | Print module names and exit |
| `--list-profiles` | | Print profile names and exit |

### Rules of thumb

- **No flags** → interactive menu (pick profile or custom modules; platform modules ask core/advanced/extreme).
- **`--profile`** and **`--modules`** → if both are passed, whichever is handled first in your command wins by script order: CLI modules take priority when `-m` is set.
- **`post`** is appended automatically when you use `-m` so you always get the final report.
- **`-y`** still may prompt less for cloud provider multi-select when ASSUME_YES installs all three clouds.

```bash
# Valid combinations
./install.sh -p full
./install.sh -p devops -y
./install.sh -m base,shell,desktop
./install.sh -m devops,cloud -y
./install.sh --dry-run -p extreme
./install.sh -h
```

---

## Profiles (`--profile`)

Presets that select a bundle of modules for you.

| Profile | Command | Modules included | Default tool tier | Best for |
|---------|---------|------------------|-------------------|----------|
| **minimal** | `./install.sh --profile minimal` | `base` `shell` `post` | — | Servers, shell-only |
| **devops** | `./install.sh --profile devops` | `base` `shell` `devtools` `devops` `sre` `cloud` `security` `post` | prompted / **advanced** with `-y` | Headless engineer box |
| **platform** | `./install.sh --profile platform` | same idea as devops (no desktop) | **advanced** | Headless platform engineer |
| **full** | `./install.sh --profile full` | desktop + full platform + virt + laptop | prompted / **advanced** with `-y` | Daily-driver laptop |
| **laptop** | `./install.sh --profile laptop` | same as full (+ laptop emphasis) | prompted / **advanced** with `-y` | ThinkPad / battery focus |
| **extreme** | `./install.sh --profile extreme` | everything | **extreme** | Max CLI arsenal |

```bash
./install.sh --list-profiles

./install.sh --profile minimal
./install.sh --profile devops -y
./install.sh --profile platform -y
./install.sh --profile full
./install.sh --profile laptop -y
./install.sh --profile extreme -y
```

Profile definition files live in `profiles/*.conf` if you want to edit or add your own.

---

## Modules (`--modules`)

Run only what you need. Comma-separated, no spaces (or quote the list).

```bash
./install.sh --list-modules
# base shell desktop devtools devops sre cloud security virt laptop post
```

| Module | What it does |
|--------|----------------|
| **base** | Core CLI, fonts, NetworkManager bits, PipeWire stack, zsh plugins, starship/zoxide fallbacks |
| **shell** | Deploy `.zshrc`, `.tmux.conf`, starship, gitconfig; set default shell to zsh |
| **desktop** | i3 + i3status, kitty, rofi, dunst, flameshot, thunar, SDDM, wallpapers, scripts under `~/Arch` |
| **devtools** | Rust (rustup), Go, Node/npm; optional nvm |
| **devops** | Containers, Kubernetes, IaC, GitOps, local CI, OCI supply chain (**tiered**) |
| **sre** | Observability CLIs, load testing, chaos, DR tools (**tiered**) |
| **cloud** | AWS · GCP · Azure CLIs + ecosystem tools (**tiered**; multi-select providers interactively) |
| **security** | DevSecOps: scanners, secrets, policy-as-code, k8s security (**tiered**) |
| **virt** | QEMU/KVM, libvirt, virt-manager; user groups |
| **laptop** | TLP, ThinkPad battery thresholds, lock-before-sleep |
| **post** | Final summary + install report (auto-added with `-m`) |

```bash
# Single domain
./install.sh --modules base
./install.sh --modules shell
./install.sh --modules desktop
./install.sh --modules devtools
./install.sh --modules devops
./install.sh --modules sre
./install.sh --modules cloud
./install.sh --modules security
./install.sh --modules virt
./install.sh --modules laptop

# Combinations
./install.sh --modules base,shell
./install.sh --modules shell,desktop
./install.sh --modules devops,sre
./install.sh --modules cloud,security
./install.sh --modules devops,sre,cloud,security
./install.sh --modules base,shell,desktop,devtools,devops,sre,cloud,security,virt,laptop

# Re-apply only configs after you edited files in configs/
./install.sh --modules shell,desktop
```

---

## Environment variables

Prefix any `./install.sh` command.

| Variable | Values | Default | Effect |
|----------|--------|---------|--------|
| `BABY_DEFAULT_TIER` | `core` \| `advanced` \| `extreme` | `advanced` (when `-y`) | Tool install depth for devops/sre/cloud/security when non-interactive |
| `BABY_ON_FAIL` | `skip` \| `retry_once` \| `abort` | `skip` | What `-y` does when a step fails |
| `BABY_SYSTEM_BINS` | `1` \| `0` | `1` | `1` = install CLIs to `/usr/local/bin`; `0` = `~/.local/bin` |
| `BABY_FORCE_REINSTALL` | `1` \| `0` | `0` | Re-download/install tools even if already on PATH |
| `BABY_HOME` | path | `$HOME/Arch` | Where Scripts + Wallpapers + notification sound land |
| `GIT_NAME` | string | prompted | Optional default for git `user.name` |
| `GIT_EMAIL` | string | prompted | Optional default for git `user.email` |

```bash
# Extreme depth, headless platform modules, auto-skip failures
BABY_DEFAULT_TIER=extreme ./install.sh --modules devops,sre,cloud,security -y

# One automatic retry per failed step, then skip
BABY_ON_FAIL=retry_once ./install.sh --profile devops -y

# Abort whole install on first failure
BABY_ON_FAIL=abort ./install.sh --profile full -y

# User-local binaries (no /usr/local/bin)
BABY_SYSTEM_BINS=0 ./install.sh --modules devops -y

# Force reinstall tools already present
BABY_FORCE_REINSTALL=1 ./install.sh --modules devops,cloud -y

# Custom asset/scripts root
BABY_HOME=$HOME/.baby ./install.sh --modules desktop

# Combine several
BABY_HOME=$HOME/Arch \
BABY_DEFAULT_TIER=extreme \
BABY_ON_FAIL=retry_once \
BABY_SYSTEM_BINS=1 \
  ./install.sh --profile platform -y
```

---

## Tool depth tiers (devops · sre · cloud · security)

These four modules ask for depth unless you use `-y` (then `BABY_DEFAULT_TIER` applies).

| Tier | Intent | When |
|------|--------|------|
| **core** | Daily essentials | Light machine / quick bootstrap |
| **advanced** | Production daily-driver | Default with `-y` |
| **extreme** | Full platform-engineer arsenal | `--profile extreme` or `BABY_DEFAULT_TIER=extreme` |
| **skip** | Do not install this domain | Interactive only |

Full tool lists per tier: **[docs/PLATFORM-TOOLS.md](docs/PLATFORM-TOOLS.md)**.

```bash
# Interactive: you pick core / advanced / extreme per domain
./install.sh --modules devops,sre,cloud,security

# Non-interactive extreme
BABY_DEFAULT_TIER=extreme ./install.sh --modules devops,sre,cloud,security -y

# Non-interactive core only
BABY_DEFAULT_TIER=core ./install.sh --modules devops,cloud -y
```

---

## Failure handling

Steps are wrapped so a single failure does **not** kill the whole install (unless you abort).

### Interactive prompt on failure

| Key | Action |
|-----|--------|
| **R** | Retry this step |
| **S** | Skip and continue (default) |
| **D** | Show full error log, then choose again |
| **A** | Abort entire installation |

### End-of-run artifacts

| Path | Purpose |
|------|---------|
| `~/.local/state/baby-linux/install-report.txt` | Full success/skip/fail report |
| `~/.local/state/baby-linux/skipped.txt` | Every skipped step + reason |
| `~/.local/state/baby-linux/failed.txt` | Hard failures / soft-fails |
| `~/.local/state/baby-linux/missing-commands.txt` | Tools still not on PATH |
| `~/.local/state/baby-linux/RETRY-MANUALLY.md` | Human checklist if anything skipped |
| `~/.local/state/baby-linux/install.log` | Verbose install log |

```bash
# After a partial install, re-run only what you need
./install.sh --modules devops,cloud,security
less ~/.local/state/baby-linux/RETRY-MANUALLY.md
```

---

## Ready-to-copy examples

### 1) Fresh Arch laptop (recommended)

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh
# choose: Full daily driver
# for platform modules pick: advanced or extreme
```

### 2) Fresh Arch laptop, mostly automatic

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh --profile full -y
```

### 3) Headless cloud / SRE workstation

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh --profile devops -y
```

### 4) Maximum tools, no desktop GUI

```bash
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh --profile extreme -y
# or:
BABY_DEFAULT_TIER=extreme ./install.sh --profile platform -y
```

### 5) Only shell + editor configs on an existing system

```bash
cd Baby-Linux
./install.sh --modules shell
```

### 6) Only i3 desktop stack

```bash
./install.sh --modules base,shell,desktop
```

### 7) Only Kubernetes / IaC / GitOps toolkit

```bash
BABY_DEFAULT_TIER=advanced ./install.sh --modules devops -y
```

### 8) Only multi-cloud CLIs

```bash
./install.sh --modules cloud
# interactive: pick AWS / GCP / Azure and tier
```

### 9) Only security scanners

```bash
BABY_DEFAULT_TIER=extreme ./install.sh --modules security -y
```

### 10) Debian / Ubuntu

```bash
sudo apt update && sudo apt install -y git curl
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh --profile full
```

### 11) Fedora

```bash
sudo dnf install -y git curl
git clone https://github.com/OneRohanDesai/Baby-Linux.git
cd Baby-Linux
./install.sh --profile devops -y
```

### 12) Inspect before changing the system

```bash
./install.sh --dry-run --profile full
./install.sh --dry-run --modules devops,sre,cloud,security
```

---

## After install

1. **Log out / reboot** so group membership (`docker`, `libvirt`) and zsh apply.
2. At the display manager, choose **i3** (if desktop was installed).
3. Cloud auth (as needed):
   ```bash
   aws configure          # or: aws sso login
   gcloud init
   az login
   ```
4. Optional checks:
   ```bash
   k9s
   terraform version
   baby-sec-scan .
   ```
5. Restore **secrets yourself** (never shipped in this repo):
   - `~/.ssh` · `~/.kube` · `~/.aws` · `~/.config/gcloud` · `~/.azure` · `~/.gnupg`

### i3 keybindings (if desktop installed)

| Binding | Action |
|---------|--------|
| `Super+Return` | Kitty terminal |
| `Super+d` | Rofi app launcher |
| `Super+Shift+d` | dmenu |
| `Super+q` | Kill window |
| `Super+Shift+e` | Power menu |
| `Super+Escape` | Lock |
| `Super+1` … `0` | Workspaces |
| `Print` | Flameshot |
| `Super+Shift+s` | Script launcher |
| `Super+Shift+a` | Audio sink switcher |

---

## What gets installed

| Layer | Includes |
|-------|----------|
| **WM / DE** | i3, i3status, rofi, dunst, kitty, flameshot, thunar, SDDM |
| **Shell** | zsh, starship, zoxide, eza, bat, fzf, tmux, neovim (lazy.nvim) |
| **DevOps** | Docker/Podman, k8s CLIs, GitOps (Argo/Flux), IaC (TF/Tofu/Pulumi), supply chain |
| **SRE** | k6/vegeta, prom/loki CLIs, chaos tools, velero, otelcol, SLO helpers |
| **Cloud** | AWS (eksctl, SSM, vault helpers) · GCP (GKE auth, sql-proxy) · Azure (kubelogin, bicep) |
| **DevSecOps** | Trivy/Grype/Checkov, cosign, OPA/Kyverno, gitleaks, semgrep, kubescape, … |
| **Virt** | QEMU/KVM, libvirt, virt-manager |
| **Laptop** | TLP, ThinkPad battery thresholds, brightness keys |

Configs are **portable** (`$HOME`-aware). Full tool catalog: [docs/PLATFORM-TOOLS.md](docs/PLATFORM-TOOLS.md).

---

## Uninstall

```bash
./uninstall.sh
```

Removes **deployed configs** (with `.bak.*` backups).  
Does **not** remove system packages (docker, i3, terraform, …).

---

## Docs & layout

| Doc | Content |
|-----|---------|
| [docs/FRESH-INSTALL.md](docs/FRESH-INSTALL.md) | From bare metal / base OS to Baby Linux |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the installer is structured |
| [docs/PROFILES.md](docs/PROFILES.md) | Profiles & modules in more detail |
| [docs/PLATFORM-TOOLS.md](docs/PLATFORM-TOOLS.md) | Every platform tool by tier |

```text
install.sh              ← entrypoint (this README documents it)
uninstall.sh
lib/                    common · detect · tracker · packages · services · binaries
modules/                00-base … 41-sre … 50-cloud … 60-security … 90-postinstall
packages/               arch/ · debian/ · fedora/
configs/                i3, kitty, nvim, zsh, platform-aliases, …
scripts/                desktop helpers + scripts/platform/
assets/                 wallpaper + notification sound
systemd/                optional battery + lock units
profiles/               minimal · devops · platform · full · laptop · extreme
docs/                   guides + tool catalog
```

### Customize

```bash
# Edit package lists, then re-run that domain
vim packages/arch/devops.txt
./install.sh --modules devops

# Edit dotfiles, re-deploy
vim configs/i3/config
./install.sh --modules desktop

# Optional hook after every install
cp hooks/post-install.sh.example hooks/post-install.sh
chmod +x hooks/post-install.sh
```

### Safety

- Existing files backed up as `*.bak.<timestamp>` before overwrite
- No wipe of `$HOME`
- Secrets never stored in the repo
- Install log: `~/.local/state/baby-linux/install.log`

---

## License

[Unlicense](LICENSE) — public domain. Copy, modify, ship, sell; no attribution required.

---

## Credits

Curated from a production Arch Linux ThinkPad (i3 + DevOps toolchain) setup.  
Contributions and distro package-map fixes welcome.
