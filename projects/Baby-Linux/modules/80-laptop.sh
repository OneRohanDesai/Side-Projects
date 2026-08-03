#!/usr/bin/env bash
# Module: laptop power management + ThinkPad helpers

module_laptop() {
  header "Laptop optimizations"

  if ! is_laptop; then
    warn "No battery detected — skipping laptop module"
    return 0
  fi

  install_profile_packages laptop

  if have_cmd tlp; then
    enable_service tlp.service 2>/dev/null || true
    ok "TLP enabled"
  fi

  deploy_system_units

  ok "Laptop module complete"
}
