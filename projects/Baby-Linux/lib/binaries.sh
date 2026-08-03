#!/usr/bin/env bash
# Baby Linux — install binaries from GitHub releases, official scripts, Go, etc.
# shellcheck disable=SC2034

# Target for user-local bins (no root) vs system
BIN_DIR_USER="${BABY_BIN:-$HOME/.local/bin}"
BIN_DIR_SYSTEM="/usr/local/bin"

# Prefer system if we have sudo and BABY_SYSTEM_BINS=1 (default)
install_bin_target() {
  if [[ "${BABY_SYSTEM_BINS:-1}" == "1" ]] && [[ "${EUID}" -eq 0 || -n "$(command -v sudo 2>/dev/null)" ]]; then
    echo "$BIN_DIR_SYSTEM"
  else
    mkdir -p "$BIN_DIR_USER"
    echo "$BIN_DIR_USER"
  fi
}

# Move a local file into the bin dir with a name
install_binary() {
  local src="$1"
  local name="${2:-$(basename "$src")}"
  local dest
  dest="$(install_bin_target)/$name"
  chmod +x "$src"
  if [[ "$(dirname "$dest")" == "$BIN_DIR_SYSTEM" ]]; then
    run_root mv -f "$src" "$dest"
  else
    mv -f "$src" "$dest"
  fi
  ok "Installed $name → $dest"
}

# skip if already present unless BABY_FORCE_REINSTALL=1
need_cmd() {
  local c="$1"
  if have_cmd "$c" && [[ "${BABY_FORCE_REINSTALL:-0}" != "1" ]]; then
    ok "$c already present: $(command -v "$c")"
    return 1
  fi
  return 0
}

# Detect arch for GitHub release assets
go_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo "amd64" ;;
    aarch64 | arm64) echo "arm64" ;;
    armv7l) echo "arm" ;;
    *) echo "amd64" ;;
  esac
}

linux_uname_arch() {
  # many projects use x86_64 not amd64
  case "$(uname -m)" in
    x86_64 | amd64) echo "x86_64" ;;
    aarch64 | arm64) echo "aarch64" ;;
    *) uname -m ;;
  esac
}

# Download URL to file with curl (retries)
download() {
  local url="$1"
  local out="$2"
  info "Download: $url"
  curl -fsSL --retry 3 --retry-delay 2 -o "$out" "$url"
}

# Extract archive and find a named binary, install it
# Usage: install_from_tarball URL BINARY_NAME [strip_components_hint]
install_from_tarball() {
  local url="$1"
  local bin_name="$2"
  local tmp
  tmp="$(mktemp -d)"
  (
    cd "$tmp" || exit 1
    local archive="asset"
    case "$url" in
      *.tar.gz | *.tgz) archive="asset.tgz" ;;
      *.tar.xz) archive="asset.tar.xz" ;;
      *.tar.bz2) archive="asset.tar.bz2" ;;
      *.zip) archive="asset.zip" ;;
      *) archive="asset.bin" ;;
    esac
    download "$url" "$archive"
    case "$archive" in
      *.tgz | *.tar.gz) tar -xzf "$archive" ;;
      *.tar.xz) tar -xJf "$archive" ;;
      *.tar.bz2) tar -xjf "$archive" ;;
      *.zip) unzip -q "$archive" ;;
      *)
        # raw binary
        install_binary "$tmp/$archive" "$bin_name"
        rm -rf "$tmp"
        return 0
        ;;
    esac
    local found
    found="$(find . -type f -name "$bin_name" | head -1)"
    if [[ -z "$found" ]]; then
      # sometimes binary is only executable file
      found="$(find . -type f -executable | head -1)"
    fi
    if [[ -z "$found" ]]; then
      err "Could not find '$bin_name' in archive from $url"
      ls -laR .
      exit 1
    fi
    install_binary "$tmp/$found" "$bin_name"
  ) || {
    warn "Failed to install $bin_name from tarball"
    rm -rf "$tmp"
    return 1
  }
  rm -rf "$tmp"
}

# Install a raw binary from URL (caller may wrap with try_step)
install_raw_binary() {
  local url="$1"
  local name="$2"
  # When used as top-level tool install, offer retry UI
  if [[ "${BABY_RAW_BINARY_DIRECT:-0}" != "1" ]] && declare -F try_step >/dev/null 2>&1; then
    # Avoid double-wrapping when called from inside try_step already
    if [[ "${BABY_IN_TRY_STEP:-0}" == "1" ]]; then
      _install_raw_binary_impl "$url" "$name"
    else
      try_step "binary:${name}" _install_raw_binary_impl "$url" "$name"
    fi
  else
    _install_raw_binary_impl "$url" "$name"
  fi
}

_install_raw_binary_impl() {
  local url="$1"
  local name="$2"
  local tmp
  tmp="$(mktemp)"
  download "$url" "$tmp" || {
    err "Download failed: $url"
    rm -f "$tmp"
    return 1
  }
  install_binary "$tmp" "$name"
}

# Latest GitHub release tag (needs network)
github_latest_tag() {
  local repo="$1" # owner/name
  curl -fsSL "https://api.github.com/repos/${repo}/releases/latest" \
    | grep -oE '"tag_name":\s*"[^"]+"' | head -1 | cut -d'"' -f4
}

# Install from GitHub release by pattern (with retry/skip UI)
# Usage: install_github_release owner/repo binary_name 'regex_for_asset'
install_github_release() {
  local repo="$1"
  local bin_name="$2"
  local asset_regex="$3"

  if ! need_cmd "$bin_name"; then
    return 0
  fi

  try_step "binary:${bin_name} (${repo})" _install_github_release_impl "$repo" "$bin_name" "$asset_regex"
}

_install_github_release_impl() {
  local repo="$1"
  local bin_name="$2"
  local asset_regex="$3"

  step "Installing $bin_name from GitHub ($repo)"
  local api json url
  api="https://api.github.com/repos/${repo}/releases/latest"
  json="$(curl -fsSL "$api")" || {
    err "GitHub API failed for $repo"
    return 1
  }
  url="$(echo "$json" | grep -oE "https://[^\"]+" | grep -E "$asset_regex" | head -1)"
  if [[ -z "$url" ]]; then
    url="$(echo "$json" | grep 'browser_download_url' | grep -oE 'https://[^"]+' | grep -E "$asset_regex" | head -1)"
  fi
  if [[ -z "$url" ]]; then
    err "No asset matching /$asset_regex/ for $repo"
    echo "$json" | grep browser_download_url | head -20 >>"${LOG_FILE:-/dev/null}" 2>/dev/null || true
    return 1
  fi

  case "$url" in
    *.tar.gz | *.tgz | *.tar.xz | *.zip | *.tar.bz2)
      install_from_tarball "$url" "$bin_name"
      ;;
    *)
      install_raw_binary "$url" "$bin_name"
      ;;
  esac
}

# Go install helper (requires go)
go_install() {
  local pkg="$1"
  local bin_hint="${2:-}"
  if ! have_cmd go; then
    warn "go not available — skip go install $pkg"
    record_skip "go-install:${pkg}" "go missing" 2>/dev/null || true
    return 0
  fi
  try_step "go-install:${bin_hint:-$pkg}" bash -c "GOBIN=\"$(install_bin_target)\" go install \"$pkg\""
}

# npm global install into user prefix when possible
npm_global() {
  local pkg="$1"
  if ! have_cmd npm; then
    warn "npm missing — skip $pkg"
    record_skip "npm:${pkg}" "npm missing" 2>/dev/null || true
    return 0
  fi
  try_step "npm-global:${pkg}" _npm_global_impl "$pkg"
}

_npm_global_impl() {
  local pkg="$1"
  step "npm i -g $pkg"
  if [[ -w /usr/lib/node_modules ]] 2>/dev/null || [[ "${EUID}" -eq 0 ]]; then
    run_root npm install -g "$pkg" || npm install -g "$pkg"
  else
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global" 2>/dev/null || true
    export PATH="$HOME/.npm-global/bin:$PATH"
    npm install -g "$pkg"
  fi
}

# pipx or pip user install
pip_user_install() {
  local pkg="$1"
  if ! have_cmd pipx && ! have_cmd pip3 && ! have_cmd pip; then
    warn "No pip/pipx — skip $pkg"
    record_skip "pip:${pkg}" "no pip" 2>/dev/null || true
    return 0
  fi
  try_step "pip:${pkg}" _pip_user_impl "$pkg"
}

_pip_user_impl() {
  local pkg="$1"
  if have_cmd pipx; then
    pipx install "$pkg" 2>/dev/null || pipx upgrade "$pkg"
  elif have_cmd pip3; then
    pip3 install --user "$pkg"
  else
    pip install --user "$pkg"
  fi
}

# Run official install script from URL (piped carefully)
run_install_script() {
  local url="$1"
  shift
  try_step "install-script:$(basename "$url")" \
    bash -c 'curl -fsSL "$1" | bash -s -- "${@:2}"' bash "$url" "$@"
}

# Verify a list of commands after install (tracks missing for final report)
verify_tools() {
  if declare -F verify_tools_tracked >/dev/null 2>&1; then
    verify_tools_tracked "$@"
    return 0
  fi
  local label="$1"
  shift
  local okc=0 miss=0 c
  echo -e "${C_DIM}── verify: $label ──${C_RESET}"
  for c in "$@"; do
    if have_cmd "$c"; then
      echo -e "  ${C_GREEN}✓${C_RESET} $c"
      ((okc++)) || true
    else
      echo -e "  ${C_RED}✗${C_RESET} $c"
      ((miss++)) || true
    fi
  done
  info "$label: $okc present, $miss missing"
}

# Tier prompt helper: sets REPLY_TIER to core|advanced|extreme|skip
ask_tier() {
  local domain="$1"
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    REPLY_TIER="${BABY_DEFAULT_TIER:-advanced}"
    info "Non-interactive: $domain tier = $REPLY_TIER"
    return 0
  fi
  ask_choice "Install depth for ${domain}" \
    "Core (essentials only)" \
    "Advanced (production daily-driver)" \
    "EXTREME (full platform-engineer arsenal)" \
    "Skip this domain"
  case "$REPLY_CHOICE" in
    1) REPLY_TIER="core" ;;
    2) REPLY_TIER="advanced" ;;
    3) REPLY_TIER="extreme" ;;
    4) REPLY_TIER="skip" ;;
  esac
}

tier_at_least() {
  # usage: tier_at_least "$REPLY_TIER" advanced  → true if advanced or extreme
  local current="$1"
  local need="$2"
  case "$need" in
    core) [[ "$current" != "skip" ]] ;;
    advanced) [[ "$current" == "advanced" || "$current" == "extreme" ]] ;;
    extreme) [[ "$current" == "extreme" ]] ;;
    *) return 1 ;;
  esac
}
