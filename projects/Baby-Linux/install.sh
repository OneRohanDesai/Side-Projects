#!/usr/bin/env bash
# ============================================================================
#  Baby Linux — one-shot multi-distro bootstrap
#  Usage:
#    ./install.sh                  # interactive
#    ./install.sh --profile full   # non-interactive profile
#    ./install.sh --profile devops
#    ./install.sh --modules base,shell,desktop
#    ./install.sh --dry-run
#    ./install.sh --help
# ============================================================================
set -euo pipefail

BABY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BABY_ROOT

# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/common.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/detect.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/tracker.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/packages.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/services.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/binaries.sh"

# Modules
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/00-base.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/10-shell.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/20-desktop.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/30-devtools.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/40-devops.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/41-sre.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/50-cloud.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/60-security.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/70-virt.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/80-laptop.sh"
# shellcheck source=/dev/null
source "${BABY_ROOT}/modules/90-postinstall.sh"

DRY_RUN=0
PROFILE=""
MODULES_CLI=""
ASSUME_YES=0

usage() {
  cat <<EOF
Baby Linux v${BABY_VERSION} — multi-distro Linux bootstrap for DevOps/SRE/Cloud/DevSecOps

USAGE
  ./install.sh [OPTIONS]

OPTIONS
  -h, --help              Show this help
  -p, --profile NAME      Preset: minimal|devops|platform|full|laptop|extreme
  -m, --modules LIST      Comma-separated modules to run
  -y, --yes               Non-interactive; default tool tier = advanced
                          (override with BABY_DEFAULT_TIER=core|advanced|extreme)
                          On failure: auto-skip (set BABY_ON_FAIL=retry_once|abort)
  --dry-run               Detect system and show plan; do not install
  --list-modules          List available modules
  --list-profiles         List available profiles

MODULES
  base       Core CLI tools, fonts, network, audio stack
  shell      zsh, starship, tmux, git config
  desktop    i3 WM, kitty, rofi, dunst, wallpapers, scripts
  devtools   Rust/Go/Node toolchains
  devops     Containers, k8s, IaC, GitOps (tiered: core→extreme)
  sre        Observability, load, chaos, DR CLIs (tiered)
  cloud      AWS · GCP · Azure deep toolchains (tiered)
  security   DevSecOps scanners, policy-as-code, secrets (tiered)
  virt       QEMU/KVM, libvirt, virt-manager
  laptop     TLP, battery thresholds (ThinkPad-friendly)
  post       Final summary (always runs last if anything else ran)

PROFILES
  minimal    base + shell
  devops     base + shell + devops + sre + cloud + security
  platform   headless platform-engineer (advanced tier)
  full       desktop daily driver + platform stack
  laptop     full + power management
  extreme    everything at EXTREME tool tier

ENV
  BABY_DEFAULT_TIER=extreme   Force tool depth with -y
  BABY_SYSTEM_BINS=0          Install CLIs to ~/.local/bin instead of /usr/local/bin
  BABY_FORCE_REINSTALL=1      Re-download tools even if present
  BABY_ON_FAIL=skip           Non-interactive fail policy: skip|retry_once|abort

EXAMPLES
  git clone https://github.com/OneRohanDesai/Baby-Linux.git
  cd Baby-Linux && ./install.sh

  # Extreme platform arsenal (no desktop):
  BABY_DEFAULT_TIER=extreme ./install.sh --profile platform -y

  # Only deep cloud + security:
  ./install.sh --modules cloud,security

  # Full catalog: docs/PLATFORM-TOOLS.md

EOF
}

list_modules() {
  cat <<EOF
base shell desktop devtools devops sre cloud security virt laptop post
EOF
}

load_profile() {
  local name="$1"
  local file="${BABY_ROOT}/profiles/${name}.conf"
  if [[ ! -f "$file" ]]; then
    die "Unknown profile: $name (see --list-profiles)"
  fi
  # shellcheck source=/dev/null
  source "$file"
  info "Loaded profile: $name → modules: ${PROFILE_MODULES}"
}

run_module() {
  local name="$1"
  case "$name" in
    base)     module_base ;;
    shell)    module_shell ;;
    desktop)  module_desktop ;;
    devtools) module_devtools ;;
    devops)   module_devops ;;
    sre)      module_sre ;;
    cloud)    module_cloud ;;
    security) module_security ;;
    virt)     module_virt ;;
    laptop)   module_laptop ;;
    post)     module_postinstall ;;
    *)
      warn "Unknown module: $name"
      ;;
  esac
}

interactive_select() {
  header "What should we install?"
  echo -e "  ${C_DIM}Pick a profile, or customize modules.${C_RESET}"
  echo -e "  ${C_DIM}Platform modules (devops/sre/cloud/security) later ask core|advanced|extreme depth.${C_RESET}"
  echo
  ask_choice "Installation profile" \
    "Full daily driver (desktop + platform stack) — recommended" \
    "Platform engineer EXTREME (all tools, no desktop)" \
    "DevOps / SRE headless (advanced tier)" \
    "Minimal (CLI + shell only)" \
    "Laptop pack (full + power mgmt)" \
    "Custom module selection"

  case "$REPLY_CHOICE" in
    1) PROFILE_MODULES="base shell desktop devtools devops sre cloud security virt laptop post" ;;
    2)
      export BABY_DEFAULT_TIER=extreme
      PROFILE_MODULES="base shell devtools devops sre cloud security virt post"
      ;;
    3) PROFILE_MODULES="base shell devtools devops sre cloud security post" ;;
    4) PROFILE_MODULES="base shell post" ;;
    5) PROFILE_MODULES="base shell desktop devtools devops sre cloud security virt laptop post" ;;
    6)
      ask_multi "Select modules" \
        "base (CLI core)" \
        "shell (zsh/starship/git/tmux)" \
        "desktop (i3 + apps + configs)" \
        "devtools (Rust/Go/Node)" \
        "devops (containers/k8s/IaC/GitOps)" \
        "sre (observability/load/chaos/DR)" \
        "cloud (AWS/GCP/Azure deep)" \
        "security (DevSecOps arsenal)" \
        "virt (qemu/libvirt)" \
        "laptop (tlp/battery)"
      local map=(base shell desktop devtools devops sre cloud security virt laptop)
      PROFILE_MODULES=""
      local idx
      for idx in $REPLY_MULTI; do
        PROFILE_MODULES+="${map[$((idx - 1))]} "
      done
      PROFILE_MODULES+="post"
      ;;
  esac

  SELECTED_MODULES="$PROFILE_MODULES"
  export SELECTED_MODULES
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h | --help)
        usage
        exit 0
        ;;
      -p | --profile)
        PROFILE="${2:-}"
        shift 2
        ;;
      -m | --modules)
        MODULES_CLI="${2:-}"
        shift 2
        ;;
      -y | --yes)
        ASSUME_YES=1
        export ASSUME_YES
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --list-modules)
        list_modules
        exit 0
        ;;
      --list-profiles)
        ls -1 "${BABY_ROOT}/profiles/"*.conf 2>/dev/null | xargs -n1 basename | sed 's/\.conf$//'
        exit 0
        ;;
      *)
        err "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done

  banner
  detect_system
  print_system_info
  ensure_dirs
  init_tracker

  if [[ "$PM" == "unknown" ]]; then
    die "Could not detect a supported package manager. Install packages manually and re-run with --modules shell,desktop"
  fi

  # Module selection
  if [[ -n "$MODULES_CLI" ]]; then
    PROFILE_MODULES="${MODULES_CLI//,/ }"
    # Always finish with post for report (if not already listed)
    if [[ " ${PROFILE_MODULES} " != *" post "* ]]; then
      PROFILE_MODULES+=" post"
    fi
  elif [[ -n "$PROFILE" ]]; then
    load_profile "$PROFILE"
  else
    interactive_select
  fi

  SELECTED_MODULES="${PROFILE_MODULES:-}"
  export SELECTED_MODULES

  echo
  echo -e "${C_BOLD}${C_CYAN}━━━ install plan ━━━${C_RESET}"
  echo -e "  ${C_BOLD}Modules${C_RESET} : ${C_BRIGHT_WHITE}${PROFILE_MODULES}${C_RESET}"
  echo -e "  ${C_BOLD}Failure${C_RESET} : ${C_YELLOW}on error → Retry / Skip / show Details / Abort${C_RESET}"
  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    echo -e "  ${C_BOLD}Mode${C_RESET}    : non-interactive (-y), on-fail=${C_YELLOW}${BABY_ON_FAIL:-skip}${C_RESET}"
  else
    echo -e "  ${C_BOLD}Mode${C_RESET}    : ${C_GREEN}interactive${C_RESET} (you'll be asked on each failure)"
  fi
  echo

  if [[ "$DRY_RUN" -eq 1 ]]; then
    ok "Dry-run only — no changes made"
    exit 0
  fi

  if [[ "${ASSUME_YES}" -ne 1 ]]; then
    ask_yes_no "Proceed with installation?" "yes" || die "Aborted by user"
  fi

  ensure_sudo

  # Count modules for progress (exclude post from count display optional)
  local -a mod_list=()
  local mod
  # shellcheck disable=SC2206
  mod_list=($PROFILE_MODULES)
  local total=${#mod_list[@]}
  local idx=0

  for mod in "${mod_list[@]}"; do
    ((idx++)) || true
    echo
    progress_bar "$idx" "$total" "$mod"
    # post always runs report; other modules get safe wrapper
    if [[ "$mod" == "post" ]]; then
      run_module post
    else
      # Map module name → function for safe runner
      case "$mod" in
        base)     run_module_safe "base" module_base ;;
        shell)    run_module_safe "shell" module_shell ;;
        desktop)  run_module_safe "desktop" module_desktop ;;
        devtools) run_module_safe "devtools" module_devtools ;;
        devops)   run_module_safe "devops" module_devops ;;
        sre)      run_module_safe "sre" module_sre ;;
        cloud)    run_module_safe "cloud" module_cloud ;;
        security) run_module_safe "security" module_security ;;
        virt)     run_module_safe "virt" module_virt ;;
        laptop)   run_module_safe "laptop" module_laptop ;;
        *)
          warn "Unknown module: $mod"
          record_skip "module:$mod" "unknown module name"
          ;;
      esac
    fi
  done

  # If post wasn't in the list, still print report
  if [[ " ${PROFILE_MODULES} " != *" post "* ]]; then
    print_install_report
  fi
}

main "$@"
