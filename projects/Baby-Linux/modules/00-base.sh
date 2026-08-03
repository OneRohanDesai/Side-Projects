#!/usr/bin/env bash
# Module: base system packages + directories

module_base() {
  header "Base system"
  ensure_dirs
  pm_update
  install_profile_packages base

  # zsh plugins (Arch packages)
  if [[ "$PM" == "pacman" ]]; then
    pm_install zsh-autosuggestions zsh-syntax-highlighting 2>/dev/null || true
  elif [[ "$PM" == "apt" ]]; then
    pm_install zsh-autosuggestions zsh-syntax-highlighting 2>/dev/null || true
  fi

  # starship if not in distro repos
  if ! have_cmd starship; then
    step "Installing starship via official installer"
    curl -sS https://starship.rs/install.sh | sh -s -- -y -b "$BABY_BIN" || warn "starship install failed"
  fi

  # eza / zoxide often missing on Debian
  if ! have_cmd eza && ! have_cmd exa; then
    if [[ "$PM" == "apt" ]]; then
      pm_install eza 2>/dev/null || pm_install exa 2>/dev/null || true
    fi
  fi
  if ! have_cmd zoxide; then
    step "Installing zoxide"
    curl -sS https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | bash || warn "zoxide install failed"
  fi

  ok "Base module complete"
}
