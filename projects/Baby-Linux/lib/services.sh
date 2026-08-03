#!/usr/bin/env bash
# Baby Linux — groups, services, post-install system tweaks

enable_service() {
  local unit="$1"
  if [[ "$INIT_SYSTEM" != "systemd" ]]; then
    warn "Not systemd — skip enable $unit"
    return 0
  fi
  if systemctl list-unit-files "$unit" &>/dev/null || [[ -f "/usr/lib/systemd/system/$unit" || -f "/etc/systemd/system/$unit" ]]; then
    run_root systemctl enable --now "$unit" 2>/dev/null \
      && ok "Enabled $unit" \
      || warn "Could not enable $unit"
  else
    warn "Unit not found: $unit"
  fi
}

enable_user_service() {
  local unit="$1"
  if [[ "$INIT_SYSTEM" != "systemd" ]]; then
    return 0
  fi
  systemctl --user enable --now "$unit" 2>/dev/null \
    && ok "Enabled user unit $unit" \
    || warn "Could not enable user unit $unit"
}

# Add current user to groups (docker, libvirt, wheel, …)
ensure_groups() {
  local groups=("$@")
  local g
  for g in "${groups[@]}"; do
    if getent group "$g" >/dev/null 2>&1; then
      if id -nG "$USER" | tr ' ' '\n' | grep -qx "$g"; then
        ok "Already in group: $g"
      else
        run_root usermod -aG "$g" "$USER"
        ok "Added $USER to group: $g (re-login required)"
      fi
    else
      # create common groups if missing (docker etc. usually created by package)
      warn "Group does not exist yet: $g (install the package first)"
    fi
  done
}

set_default_shell() {
  local shell_path="$1"
  if [[ ! -x "$shell_path" ]]; then
    warn "Shell not executable: $shell_path"
    return 1
  fi
  if [[ "$SHELL" == "$shell_path" ]]; then
    ok "Default shell already $shell_path"
    return 0
  fi
  if have_cmd chsh; then
    chsh -s "$shell_path" || run_root chsh -s "$shell_path" "$USER"
    ok "Default shell set to $shell_path (re-login required)"
  else
    warn "chsh not available — set shell manually to $shell_path"
  fi
}

# Deploy optional system units (ThinkPad battery, lock-before-sleep)
deploy_system_units() {
  local unit_dir="${BABY_ROOT}/systemd"
  [[ -d "$unit_dir" ]] || return 0

  if is_laptop && [[ -f "$unit_dir/battery-threshold.service" ]]; then
    if [[ -f /sys/class/power_supply/BAT0/charge_stop_threshold ]]; then
      if ask_yes_no "Install ThinkPad battery charge threshold service (80–90%)?" "yes"; then
        run_root cp "$unit_dir/battery-threshold.service" /etc/systemd/system/
        run_root systemctl daemon-reload
        enable_service battery-threshold.service
      fi
    fi
  fi

  if [[ -f "$unit_dir/lock-before-sleep.service" ]] && ask_yes_no "Lock screen automatically before sleep?" "yes"; then
    render_template "$unit_dir/lock-before-sleep.service" "${BABY_STATE}/lock-before-sleep.service"
    run_root cp "${BABY_STATE}/lock-before-sleep.service" /etc/systemd/system/lock-before-sleep.service
    run_root systemctl daemon-reload
    enable_service lock-before-sleep.service
  fi
}
