#!/usr/bin/env bash
# Baby Linux — multi-distro package installation
# shellcheck disable=SC2034

# Update package indexes
pm_update() {
  step "Updating package indexes (${PM})"
  case "$PM" in
    pacman)
      run_root pacman -Sy --noconfirm
      ;;
    apt)
      run_root apt-get update -y
      ;;
    dnf)
      run_root dnf check-update || true
      ;;
    yum)
      run_root yum check-update || true
      ;;
    zypper)
      run_root zypper --non-interactive refresh
      ;;
    xbps)
      run_root xbps-install -S
      ;;
    apk)
      run_root apk update
      ;;
    *)
      warn "Unknown package manager — skip update"
      ;;
  esac
}

# Install a list of packages; skip missing ones when possible
# Usage: pm_install pkg1 pkg2 ...
# Returns non-zero if the package manager command fails (triggers try_step).
pm_install() {
  local pkgs=("$@")
  [[ ${#pkgs[@]} -eq 0 ]] && return 0

  local clean=()
  local p
  for p in "${pkgs[@]}"; do
    [[ -z "$p" || "$p" =~ ^# ]] && continue
    clean+=("$p")
  done
  [[ ${#clean[@]} -eq 0 ]] && return 0

  info "Installing: ${clean[*]}"
  local rc=0
  case "$PM" in
    pacman)
      local available=() missing=()
      for p in "${clean[@]}"; do
        if pacman -Si "$p" &>/dev/null || pacman -Qi "$p" &>/dev/null; then
          available+=("$p")
        else
          missing+=("$p")
        fi
      done
      if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Not in official repos (try AUR later): ${missing[*]}"
        printf '%s\n' "${missing[@]}" >>"${BABY_STATE}/missing-packages.txt"
        mkdir -p "${BABY_STATE}"
        for p in "${missing[@]}"; do
          echo "pkg-not-in-repos: $p" >>"${BABY_STATE}/missing-commands.txt"
        done
      fi
      if [[ ${#available[@]} -gt 0 ]]; then
        run_root pacman -S --needed --noconfirm "${available[@]}" || rc=$?
      fi
      ;;
    apt)
      run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "${clean[@]}" || rc=$?
      ;;
    dnf)
      run_root dnf install -y "${clean[@]}" || rc=$?
      ;;
    yum)
      run_root yum install -y "${clean[@]}" || rc=$?
      ;;
    zypper)
      run_root zypper --non-interactive install -y "${clean[@]}" || rc=$?
      ;;
    xbps)
      run_root xbps-install -y "${clean[@]}" || rc=$?
      ;;
    apk)
      run_root apk add "${clean[@]}" || rc=$?
      ;;
    *)
      err "Cannot install packages — unsupported PM: $PM"
      return 1
      ;;
  esac
  return "$rc"
}

# Internal: batch install used by try_step
_pm_install_batch() {
  pm_install "$@"
}

# Install packages listed in a file (one per line, # comments ok)
pm_install_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    warn "Package list not found: $file"
    return 0
  fi
  local pkgs=()
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)" # trim
    [[ -z "$line" ]] && continue
    pkgs+=("$line")
  done <"$file"
  pm_install "${pkgs[@]}"
}

# Ensure yay (AUR helper) on Arch family
ensure_yay() {
  if have_cmd yay; then
    ok "yay already installed"
    return 0
  fi
  if [[ "$PM" != "pacman" ]]; then
    return 0
  fi
  step "Installing yay (AUR helper)"
  pm_install base-devel git go
  local tmp
  tmp="$(mktemp -d)"
  (
    cd "$tmp"
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si --noconfirm
  ) || warn "yay install failed — AUR packages will be skipped"
  rm -rf "$tmp"
}

# Install AUR packages via yay (Arch only)
aur_install() {
  local pkgs=("$@")
  [[ ${#pkgs[@]} -eq 0 ]] && return 0
  if [[ "$PM" != "pacman" ]]; then
    warn "AUR packages skipped on non-Arch: ${pkgs[*]}"
    return 0
  fi
  ensure_yay
  if ! have_cmd yay; then
    warn "yay unavailable — skip AUR: ${pkgs[*]}"
    return 0
  fi
  info "AUR install: ${pkgs[*]}"
  try_step "AUR: ${pkgs[*]}" yay -S --needed --noconfirm "${pkgs[@]}"
}

aur_install_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local pkgs=() line
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    pkgs+=("$line")
  done <"$file"
  aur_install "${pkgs[@]}"
}

# Resolve package list path for current family + name
# packages/<family>/<name>.txt  with fallback to packages/common/
pkg_list() {
  local name="$1"
  local family_file="${BABY_ROOT}/packages/${PM_FAMILY}/${name}.txt"
  local common_file="${BABY_ROOT}/packages/common/${name}.txt"
  if [[ -f "$family_file" ]]; then
    echo "$family_file"
  elif [[ -f "$common_file" ]]; then
    echo "$common_file"
  else
    echo ""
  fi
}

install_profile_packages() {
  local name="$1"
  local list
  list="$(pkg_list "$name")"
  if [[ -z "$list" ]]; then
    warn "No package list for profile '$name' on ${PM_FAMILY}"
    record_skip "packages:$name" "no list for ${PM_FAMILY}" 2>/dev/null || true
    return 0
  fi
  step "Packages: $name ($(basename "$(dirname "$list")")/$(basename "$list"))"
  local pkgs=() line
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    pkgs+=("$line")
  done <"$list"
  if [[ ${#pkgs[@]} -eq 0 ]]; then
    return 0
  fi
  # Chunk large lists so a failure can be retried without redoing everything
  local chunk_size=25
  local i=0
  local chunk=()
  local chunk_n=0
  for p in "${pkgs[@]}"; do
    chunk+=("$p")
    ((i++)) || true
    if (( i % chunk_size == 0 )); then
      ((chunk_n++)) || true
      try_step "packages:${name} [batch ${chunk_n}]" pm_install "${chunk[@]}"
      chunk=()
    fi
  done
  if [[ ${#chunk[@]} -gt 0 ]]; then
    ((chunk_n++)) || true
    try_step "packages:${name} [batch ${chunk_n}]" pm_install "${chunk[@]}"
  fi
}
