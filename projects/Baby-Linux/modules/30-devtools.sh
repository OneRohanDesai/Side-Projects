#!/usr/bin/env bash
# Module: languages & editors (Go, Rust, Node already via packages where possible)

module_devtools() {
  header "Developer toolchains"

  # Ensure nvim config even without full desktop
  deploy_file "${BABY_ROOT}/configs/nvim/init.lua" "$HOME/.config/nvim/init.lua"

  # Rust via rustup (official, multi-distro)
  if ask_yes_no "Install Rust (rustup)?" "yes"; then
    if have_cmd rustc && have_cmd cargo; then
      ok "Rust already present: $(rustc --version 2>/dev/null)"
    else
      step "Installing rustup"
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      # shellcheck disable=SC1091
      [[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
      ok "Rust installed"
    fi
  fi

  # Go — package or skip
  if ! have_cmd go; then
    if ask_yes_no "Install Go via package manager?" "yes"; then
      pm_install go golang-go golang 2>/dev/null || true
    fi
  else
    ok "Go present: $(go version 2>/dev/null)"
  fi

  # Node — package
  if ! have_cmd node; then
    if ask_yes_no "Install Node.js via package manager?" "yes"; then
      pm_install nodejs npm 2>/dev/null || true
    fi
  else
    ok "Node present: $(node -v 2>/dev/null)"
  fi

  # Optional: nvm for version management
  if ask_yes_no "Install nvm (Node Version Manager)?" "no"; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash || warn "nvm install failed"
  fi

  ok "Devtools module complete"
}
