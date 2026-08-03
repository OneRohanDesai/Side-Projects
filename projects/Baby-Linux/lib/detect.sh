#!/usr/bin/env bash
# Baby Linux — distro / package-manager detection
# shellcheck disable=SC2034

# Sets: DISTRO_ID DISTRO_LIKE DISTRO_VERSION DISTRO_NAME PM PM_INSTALL PM_UPDATE
#        PM_QUERY ARCH INIT_SYSTEM

detect_system() {
  DISTRO_ID="unknown"
  DISTRO_LIKE=""
  DISTRO_VERSION=""
  DISTRO_NAME="Unknown Linux"
  PM=""
  ARCH="$(uname -m)"
  INIT_SYSTEM="unknown"

  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_LIKE="${ID_LIKE:-}"
    DISTRO_VERSION="${VERSION_ID:-}"
    DISTRO_NAME="${PRETTY_NAME:-$NAME}"
  fi

  if have_cmd systemctl && [[ -d /run/systemd/system ]]; then
    INIT_SYSTEM="systemd"
  elif [[ -d /etc/init.d ]]; then
    INIT_SYSTEM="sysv"
  fi

  # Package manager priority by family
  case "$DISTRO_ID" in
    arch | artix | manjaro | endeavour | garuda | cachyos | archcraft)
      PM="pacman"
      ;;
    debian | ubuntu | pop | linuxmint | elementary | zorin | neon | kali | raspbian | pureos | mx)
      PM="apt"
      ;;
    fedora | rhel | centos | rocky | almalinux | ol | nobara)
      if have_cmd dnf; then PM="dnf"; else PM="yum"; fi
      ;;
    opensuse* | sles | tumbleweed | leap)
      PM="zypper"
      ;;
    void)
      PM="xbps"
      ;;
    alpine)
      PM="apk"
      ;;
    gentoo)
      PM="emerge"
      ;;
    nixos)
      PM="nix"
      ;;
    *)
      # Fall back via ID_LIKE
      if [[ "$DISTRO_LIKE" == *arch* ]]; then
        PM="pacman"
      elif [[ "$DISTRO_LIKE" == *debian* || "$DISTRO_LIKE" == *ubuntu* ]]; then
        PM="apt"
      elif [[ "$DISTRO_LIKE" == *fedora* || "$DISTRO_LIKE" == *rhel* ]]; then
        PM="dnf"
      elif [[ "$DISTRO_LIKE" == *suse* ]]; then
        PM="zypper"
      elif have_cmd pacman; then
        PM="pacman"
      elif have_cmd apt-get; then
        PM="apt"
      elif have_cmd dnf; then
        PM="dnf"
      elif have_cmd zypper; then
        PM="zypper"
      elif have_cmd xbps-install; then
        PM="xbps"
      elif have_cmd apk; then
        PM="apk"
      else
        PM="unknown"
      fi
      ;;
  esac

  case "$PM" in
    pacman)
      PM_FAMILY="arch"
      ;;
    apt)
      PM_FAMILY="debian"
      ;;
    dnf | yum)
      PM_FAMILY="fedora"
      ;;
    zypper)
      PM_FAMILY="suse"
      ;;
    *)
      PM_FAMILY="generic"
      ;;
  esac

  export DISTRO_ID DISTRO_LIKE DISTRO_VERSION DISTRO_NAME PM PM_FAMILY ARCH INIT_SYSTEM
}

print_system_info() {
  info "OS          : ${DISTRO_NAME}"
  info "ID          : ${DISTRO_ID} (like: ${DISTRO_LIKE:-n/a})"
  info "Package mgr : ${PM} (family: ${PM_FAMILY})"
  info "Arch        : ${ARCH}"
  info "Init        : ${INIT_SYSTEM}"
  info "User        : ${USER} (uid $(id -u))"
  info "Home        : ${HOME}"
  info "Laptop      : $(is_laptop && echo yes || echo no)"
  info "WSL         : $(is_wsl && echo yes || echo no)"
  info "Repo        : ${BABY_ROOT}"
}
