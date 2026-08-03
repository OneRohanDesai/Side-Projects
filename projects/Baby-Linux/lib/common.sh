#!/usr/bin/env bash
# Baby Linux — shared helpers (colors, logging, prompts, paths)
# shellcheck disable=SC2034

set -euo pipefail

# Resolve repo root even when sourced from modules
if [[ -z "${BABY_ROOT:-}" ]]; then
  _common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  BABY_ROOT="$(cd "${_common_dir}/.." && pwd)"
fi

BABY_VERSION="1.0.0"
BABY_HOME="${BABY_HOME:-$HOME/Arch}"
BABY_SHARE="${XDG_DATA_HOME:-$HOME/.local/share}/baby-linux"
BABY_STATE="${XDG_STATE_HOME:-$HOME/.local/state}/baby-linux"
BABY_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
BABY_BIN="${HOME}/.local/bin"
LOG_FILE="${BABY_STATE}/install.log"

# ── Colors (disable if not a TTY) ───────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
  C_WHITE=$'\033[37m'
  C_BRIGHT_RED=$'\033[91m'
  C_BRIGHT_GREEN=$'\033[92m'
  C_BRIGHT_YELLOW=$'\033[93m'
  C_BRIGHT_CYAN=$'\033[96m'
  C_BRIGHT_WHITE=$'\033[97m'
else
  C_RESET= C_BOLD= C_DIM= C_RED= C_GREEN= C_YELLOW=
  C_BLUE= C_MAGENTA= C_CYAN= C_WHITE=
  C_BRIGHT_RED= C_BRIGHT_GREEN= C_BRIGHT_YELLOW= C_BRIGHT_CYAN= C_BRIGHT_WHITE=
fi

# ── Logging ─────────────────────────────────────────────────────────────────
_ensure_log() {
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  touch "$LOG_FILE" 2>/dev/null || true
}

log() {
  _ensure_log
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" >>"$LOG_FILE" 2>/dev/null || true
}

info()    { echo -e "${C_CYAN}ℹ${C_RESET}  $*"; log "INFO  $*"; }
ok()      { echo -e "${C_GREEN}✓${C_RESET}  $*"; log "OK    $*"; }
warn()    { echo -e "${C_YELLOW}!${C_RESET}  $*"; log "WARN  $*"; }
err()     { echo -e "${C_RED}✗${C_RESET}  $*" >&2; log "ERROR $*"; }
step()    { echo -e "\n${C_BOLD}${C_BLUE}▶${C_RESET} ${C_BOLD}$*${C_RESET}"; log "STEP  $*"; }
header()  {
  echo
  echo -e "${C_BOLD}${C_MAGENTA}╔══════════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}║${C_RESET}  ${C_BOLD}$*${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}╚══════════════════════════════════════════════════════════════╝${C_RESET}"
  log "HDR   $*"
}

die() { err "$*"; exit 1; }

# ── Privilege ───────────────────────────────────────────────────────────────
have_cmd() { command -v "$1" >/dev/null 2>&1; }

# Run as root when needed. Prefer sudo; fall back to doas; else fail.
run_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  elif have_cmd sudo; then
    sudo "$@"
  elif have_cmd doas; then
    doas "$@"
  else
    die "Need root for: $*  (install sudo or run as root)"
  fi
}

# Ask for sudo once early so later prompts don't interrupt installs
ensure_sudo() {
  if [[ "${EUID}" -eq 0 ]]; then
    return 0
  fi
  if have_cmd sudo; then
    info "Requesting sudo privileges (needed for package install & services)…"
    sudo -v || die "sudo authentication failed"
    # Keep sudo alive while installer runs
    (
      while true; do
        sudo -n true
        sleep 50
        kill -0 "$$" 2>/dev/null || exit
      done
    ) 2>/dev/null &
    SUDO_KEEPER_PID=$!
    trap 'kill ${SUDO_KEEPER_PID:-0} 2>/dev/null || true' EXIT
  else
    warn "sudo not found — package installs may fail unless you are root"
  fi
}

# ── Prompts ─────────────────────────────────────────────────────────────────
# ask_yes_no "Question?" default_yes|default_no
ask_yes_no() {
  local prompt="$1"
  local default="${2:-yes}"
  local yn
  if [[ "$default" == "yes" ]]; then
    read -r -p "$(echo -e "${C_YELLOW}?${C_RESET}  ${prompt} [Y/n] ")" yn
    case "${yn:-Y}" in
      [Yy]* | "") return 0 ;;
      *) return 1 ;;
    esac
  else
    read -r -p "$(echo -e "${C_YELLOW}?${C_RESET}  ${prompt} [y/N] ")" yn
    case "${yn:-N}" in
      [Yy]*) return 0 ;;
      *) return 1 ;;
    esac
  fi
}

# ask_choice "Prompt" "opt1" "opt2" ...
# Sets global REPLY_CHOICE to 1-based index or the custom "Other" text
ask_choice() {
  local prompt="$1"
  shift
  local options=("$@")
  local i=1
  echo -e "${C_YELLOW}?${C_RESET}  ${C_BOLD}${prompt}${C_RESET}"
  for opt in "${options[@]}"; do
    echo -e "    ${C_CYAN}${i})${C_RESET} ${opt}"
    ((i++)) || true
  done
  local choice
  while true; do
    read -r -p "    Select [1-${#options[@]}]: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && ((choice >= 1 && choice <= ${#options[@]})); then
      REPLY_CHOICE="$choice"
      REPLY_VALUE="${options[$((choice - 1))]}"
      return 0
    fi
    warn "Invalid choice"
  done
}

# Multi-select: space-separated numbers, empty = none
# Sets REPLY_MULTI as space-separated 1-based indices
ask_multi() {
  local prompt="$1"
  shift
  local options=("$@")
  local i=1
  echo -e "${C_YELLOW}?${C_RESET}  ${C_BOLD}${prompt}${C_RESET}"
  echo -e "    ${C_DIM}(space-separated numbers, or 'all' / 'none')${C_RESET}"
  for opt in "${options[@]}"; do
    echo -e "    ${C_CYAN}${i})${C_RESET} ${opt}"
    ((i++)) || true
  done
  local raw
  read -r -p "    Select: " raw
  REPLY_MULTI=""
  if [[ -z "$raw" || "$raw" == "none" ]]; then
    return 0
  fi
  if [[ "$raw" == "all" ]]; then
    local j
    for ((j = 1; j <= ${#options[@]}; j++)); do
      REPLY_MULTI+="$j "
    done
    return 0
  fi
  for token in $raw; do
    if [[ "$token" =~ ^[0-9]+$ ]] && ((token >= 1 && token <= ${#options[@]})); then
      REPLY_MULTI+="$token "
    fi
  done
}

ask_input() {
  local prompt="$1"
  local default="${2:-}"
  local val
  if [[ -n "$default" ]]; then
    read -r -p "$(echo -e "${C_YELLOW}?${C_RESET}  ${prompt} [${default}]: ")" val
    REPLY_INPUT="${val:-$default}"
  else
    read -r -p "$(echo -e "${C_YELLOW}?${C_RESET}  ${prompt}: ")" val
    REPLY_INPUT="$val"
  fi
}

# ── FS helpers ──────────────────────────────────────────────────────────────
ensure_dirs() {
  mkdir -p \
    "$BABY_HOME"/{Wallpapers,Scripts} \
    "$BABY_SHARE" \
    "$BABY_STATE" \
    "$BABY_BIN" \
    "$BABY_CONFIG" \
    "$HOME/.local/share/applications"
}

# Backup existing file/dir then copy
backup_path() {
  local path="$1"
  if [[ -e "$path" && ! -L "$path" ]]; then
    local bak="${path}.bak.$(date +%Y%m%d%H%M%S)"
    mv "$path" "$bak"
    info "Backed up $path → $bak"
  elif [[ -L "$path" ]]; then
    rm -f "$path"
  fi
}

# Deploy a file: copy from repo to dest, optional executable bit
deploy_file() {
  local src="$1"
  local dest="$2"
  local mode="${3:-}"
  mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" ]]; then
    if cmp -s "$src" "$dest" 2>/dev/null; then
      return 0
    fi
    backup_path "$dest"
  fi
  cp -a "$src" "$dest"
  [[ -n "$mode" ]] && chmod "$mode" "$dest"
  ok "Deployed $(basename "$src") → $dest"
}

# Recursive deploy of a directory's contents
deploy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  # shellcheck disable=SC2044
  local f rel
  while IFS= read -r -d '' f; do
    rel="${f#"$src"/}"
    deploy_file "$f" "$dest/$rel"
  done < <(find "$src" -type f -print0 2>/dev/null)
}

# Replace @HOME@ @USER@ placeholders in a file
render_template() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [[ -e "$dest" ]]; then
    backup_path "$dest"
  fi
  sed \
    -e "s|@HOME@|${HOME}|g" \
    -e "s|@USER@|${USER}|g" \
    -e "s|@BABY_HOME@|${BABY_HOME}|g" \
    -e "s|@BABY_SHARE@|${BABY_SHARE}|g" \
    "$src" >"$dest"
  ok "Rendered $(basename "$src") → $dest"
}

is_wsl() {
  grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null
}

is_laptop() {
  [[ -d /sys/class/power_supply/BAT0 ]] || [[ -d /sys/class/power_supply/BAT1 ]]
}

banner() {
  echo
  echo -e "${C_BOLD}${C_CYAN}  ██████╗  █████╗ ██████╗ ██╗   ██╗    ██╗     ██╗███╗   ██╗██╗   ██╗██╗  ██╗${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}  ██╔══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝    ██║     ██║████╗  ██║██║   ██║╚██╗██╔╝${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}  ██████╔╝███████║██████╔╝ ╚████╔╝     ██║     ██║██╔██╗ ██║██║   ██║ ╚███╔╝${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}  ██╔══██╗██╔══██║██╔══██╗  ╚██╔╝      ██║     ██║██║╚██╗██║██║   ██║ ██╔██╗${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}  ██████╔╝██║  ██║██████╔╝   ██║       ███████╗██║██║ ╚████║╚██████╔╝██╔╝ ██╗${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}  ╚═════╝ ╚═╝  ╚═╝╚═════╝    ╚═╝       ╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝${C_RESET}"
  echo
  echo -e "  ${C_BRIGHT_WHITE}One-shot Linux bootstrap${C_RESET} ${C_DIM}for${C_RESET} ${C_GREEN}DevOps${C_RESET} · ${C_CYAN}Cloud${C_RESET} · ${C_YELLOW}SRE${C_RESET} · ${C_RED}DevSecOps${C_RESET}"
  echo -e "  ${C_DIM}v${BABY_VERSION}  ·  public domain  ·  multi-distro  ·  ${C_YELLOW}retry/skip on failure${C_RESET}"
  echo
}
