#!/usr/bin/env bash
# Module: final summary, xdg dirs, optional hooks

module_postinstall() {
  header "Post-install"

  # XDG user directories
  if have_cmd xdg-user-dirs-update; then
    try_optional "xdg-user-dirs-update" xdg-user-dirs-update
  fi

  mkdir -p "$BABY_BIN"

  # Optional user hooks
  if [[ -x "${BABY_ROOT}/hooks/post-install.sh" ]]; then
    try_step "hooks/post-install.sh" bash "${BABY_ROOT}/hooks/post-install.sh"
  fi

  # Write install manifest
  cat >"${BABY_STATE}/last-install.txt" <<EOF
timestamp=$(date -Iseconds)
user=$USER
home=$HOME
distro=$DISTRO_ID
pm=$PM
baby_root=$BABY_ROOT
baby_home=$BABY_HOME
modules=${SELECTED_MODULES:-unknown}
ok_steps=${BABY_STEP_OK:-0}
skipped_steps=${BABY_STEP_SKIP:-0}
failed_steps=${BABY_STEP_FAIL:-0}
EOF
  ok "Wrote install state → ${BABY_STATE}/last-install.txt"

  # ── Colourful failure / skip report (main deliverable) ───────────────────
  print_install_report

  # Deploy a small "retry skipped" helper if anything was skipped
  if [[ "${BABY_STEP_SKIP:-0}" -gt 0 || -s "${BABY_STATE}/missing-commands.txt" ]]; then
    cat >"${BABY_STATE}/RETRY-MANUALLY.md" <<EOF
# Baby Linux — items to finish manually

Generated: $(date -Iseconds)

## Skipped steps
\`\`\`
$(cat "${BABY_STATE}/skipped.txt" 2>/dev/null || echo none)
\`\`\`

## Missing commands
\`\`\`
$(sort -u "${BABY_STATE}/missing-commands.txt" 2>/dev/null || echo none)
\`\`\`

## How to retry

\`\`\`bash
cd ${BABY_ROOT}
# Re-run only the modules you care about (interactive retry on fail):
./install.sh --modules devops,sre,cloud,security

# Or install a single binary / package by hand, e.g.:
#   sudo pacman -S <pkg>
#   yay -S <aur-pkg>
#   curl -fsSL <url> | sudo install -m 755 /dev/stdin /usr/local/bin/<tool>
\`\`\`

Full report: ${BABY_STATE}/install-report.txt  
Log: ${LOG_FILE}
EOF
    echo -e "  ${C_YELLOW}${C_BOLD}Manual checklist saved → ${BABY_STATE}/RETRY-MANUALLY.md${C_RESET}"
  fi

  echo
  header "Next steps"
  cat <<EOF

${C_GREEN}${C_BOLD}Baby Linux finished this run.${C_RESET}

  1. ${C_BOLD}Log out / reboot${C_RESET} so groups (docker, libvirt) and zsh apply
  2. Login session: ${C_BOLD}i3${C_RESET} (if desktop was installed)
  3. Cloud login:  ${C_CYAN}aws configure${C_RESET} · ${C_CYAN}gcloud init${C_RESET} · ${C_CYAN}az login${C_RESET}
  4. If anything was ${C_YELLOW}skipped${C_RESET}, open:
       ${C_CYAN}${BABY_STATE}/RETRY-MANUALLY.md${C_RESET}
       ${C_CYAN}${BABY_STATE}/install-report.txt${C_RESET}
  5. Re-run failed modules anytime:
       ${C_CYAN}./install.sh --modules devops,cloud,security${C_RESET}

  Platform catalog: ${BABY_ROOT}/docs/PLATFORM-TOOLS.md
  Install log:      ${LOG_FILE}

EOF

  if [[ -f "${BABY_STATE}/missing-packages.txt" ]]; then
    warn "Some packages were not in repos — see ${BABY_STATE}/missing-packages.txt"
  fi
}
