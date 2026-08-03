#!/usr/bin/env bash
# Baby Linux — failure tracking, retry/skip UI, end-of-run report
# shellcheck disable=SC2034

# Arrays of "label|detail" records for this install run
declare -a BABY_OK_ITEMS=()
declare -a BABY_SKIP_ITEMS=()
declare -a BABY_FAIL_ITEMS=()
declare -a BABY_MISS_CMDS=()

BABY_STEP_COUNT=0
BABY_STEP_OK=0
BABY_STEP_SKIP=0
BABY_STEP_FAIL=0
BABY_LAST_ERROR=""
BABY_LAST_ERROR_LOG=""
BABY_ABORT_REQUESTED=0

# On fail in non-interactive (-y): skip | retry_once | abort
BABY_ON_FAIL="${BABY_ON_FAIL:-skip}"

# ── Extra colours ───────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_BGRED=$'\033[41m'
  C_BGGREEN=$'\033[42m'
  C_BGYELLOW=$'\033[43m'
  C_BGBLUE=$'\033[44m'
  C_BGMAGENTA=$'\033[45m'
  C_BRIGHT_RED=$'\033[91m'
  C_BRIGHT_GREEN=$'\033[92m'
  C_BRIGHT_YELLOW=$'\033[93m'
  C_BRIGHT_CYAN=$'\033[96m'
  C_BRIGHT_WHITE=$'\033[97m'
  C_ORANGE=$'\033[38;5;208m'
else
  C_BGRED= C_BGGREEN= C_BGYELLOW= C_BGBLUE= C_BGMAGENTA=
  C_BRIGHT_RED= C_BRIGHT_GREEN= C_BRIGHT_YELLOW= C_BRIGHT_CYAN= C_BRIGHT_WHITE=
  C_ORANGE=
fi

init_tracker() {
  BABY_OK_ITEMS=()
  BABY_SKIP_ITEMS=()
  BABY_FAIL_ITEMS=()
  BABY_MISS_CMDS=()
  BABY_STEP_COUNT=0
  BABY_STEP_OK=0
  BABY_STEP_SKIP=0
  BABY_STEP_FAIL=0
  BABY_ABORT_REQUESTED=0
  mkdir -p "$BABY_STATE"
  : >"${BABY_STATE}/ok.txt"
  : >"${BABY_STATE}/skipped.txt"
  : >"${BABY_STATE}/failed.txt"
  : >"${BABY_STATE}/missing-commands.txt"
  : >"${BABY_STATE}/last-error.txt"
  export BABY_RUN_STARTED
  BABY_RUN_STARTED="$(date -Iseconds)"
  log "TRACKER init run=$BABY_RUN_STARTED"
}

_record_line() {
  local file="$1"
  local line="$2"
  echo "$line" >>"$file" 2>/dev/null || true
}

record_ok() {
  local label="$1"
  local detail="${2:-}"
  BABY_OK_ITEMS+=("${label}|${detail}")
  ((BABY_STEP_OK++)) || true
  _record_line "${BABY_STATE}/ok.txt" "${label}${detail:+ — $detail}"
  log "TRACK OK   $label $detail"
}

record_skip() {
  local label="$1"
  local detail="${2:-user skipped}"
  BABY_SKIP_ITEMS+=("${label}|${detail}")
  ((BABY_STEP_SKIP++)) || true
  _record_line "${BABY_STATE}/skipped.txt" "${label} — ${detail}"
  log "TRACK SKIP $label $detail"
  echo -e "  ${C_YELLOW}⊘  SKIPPED${C_RESET}  ${C_BOLD}${label}${C_RESET}  ${C_DIM}(${detail})${C_RESET}"
}

record_fail() {
  local label="$1"
  local detail="${2:-failed}"
  BABY_FAIL_ITEMS+=("${label}|${detail}")
  ((BABY_STEP_FAIL++)) || true
  _record_line "${BABY_STATE}/failed.txt" "${label} — ${detail}"
  log "TRACK FAIL $label $detail"
}

record_missing_cmd() {
  local cmd="$1"
  local context="${2:-}"
  BABY_MISS_CMDS+=("${cmd}|${context}")
  _record_line "${BABY_STATE}/missing-commands.txt" "${cmd}${context:+ ($context)}"
}

# Pretty failure box
_print_fail_box() {
  local label="$1"
  local attempt="$2"
  local rc="$3"
  local err_snip="$4"

  echo
  echo -e "${C_BRIGHT_RED}${C_BOLD}┌──────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_BRIGHT_RED}${C_BOLD}│  ✗  STEP FAILED                                              │${C_RESET}"
  echo -e "${C_BRIGHT_RED}${C_BOLD}├──────────────────────────────────────────────────────────────┤${C_RESET}"
  echo -e "${C_BRIGHT_RED}│${C_RESET}  ${C_BOLD}What${C_RESET}     : ${C_BRIGHT_WHITE}${label}${C_RESET}"
  echo -e "${C_BRIGHT_RED}│${C_RESET}  ${C_BOLD}Attempt${C_RESET}  : ${attempt}"
  echo -e "${C_BRIGHT_RED}│${C_RESET}  ${C_BOLD}Exit code${C_RESET}: ${C_BRIGHT_RED}${rc}${C_RESET}"
  if [[ -n "$err_snip" ]]; then
    echo -e "${C_BRIGHT_RED}│${C_RESET}  ${C_BOLD}Error${C_RESET}    :"
    # indent last few lines
    while IFS= read -r line; do
      # truncate long lines
      local show="$line"
      ((${#show} > 56)) && show="${show:0:53}..."
      echo -e "${C_BRIGHT_RED}│${C_RESET}    ${C_DIM}${show}${C_RESET}"
    done <<<"$err_snip"
  fi
  echo -e "${C_BRIGHT_RED}${C_BOLD}└──────────────────────────────────────────────────────────────┘${C_RESET}"
  echo
}

# Ask user what to do after failure
# Sets REPLY_FAIL_ACTION to: retry | skip | abort | details
ask_fail_action() {
  local label="$1"

  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    case "${BABY_ON_FAIL}" in
      abort)
        REPLY_FAIL_ACTION="abort"
        warn "Non-interactive: aborting on failure ($label)"
        ;;
      retry_once)
        REPLY_FAIL_ACTION="retry"
        # caller should limit retries
        ;;
      *)
        REPLY_FAIL_ACTION="skip"
        warn "Non-interactive: auto-skip failed step ($label)"
        ;;
    esac
    return 0
  fi

  echo -e "  ${C_BRIGHT_CYAN}${C_BOLD}What do you want to do?${C_RESET}"
  echo -e "    ${C_BRIGHT_GREEN}[R]${C_RESET} Retry this step"
  echo -e "    ${C_BRIGHT_YELLOW}[S]${C_RESET} Skip and continue install"
  echo -e "    ${C_BRIGHT_CYAN}[D]${C_RESET} Show full error log"
  echo -e "    ${C_BRIGHT_RED}[A]${C_RESET} Abort entire installation"
  echo

  local ans
  while true; do
    read -r -p "$(echo -e "  ${C_ORANGE}➜${C_RESET}  Choice [R/S/D/A] (default S): ")" ans
    ans="${ans:-S}"
    case "${ans^^}" in
      R | RETRY)
        REPLY_FAIL_ACTION="retry"
        return 0
        ;;
      S | SKIP | "")
        REPLY_FAIL_ACTION="skip"
        return 0
        ;;
      D | DETAIL | DETAILS | L | LOG)
        REPLY_FAIL_ACTION="details"
        return 0
        ;;
      A | ABORT | Q)
        REPLY_FAIL_ACTION="abort"
        return 0
        ;;
      *)
        echo -e "  ${C_DIM}Please enter R, S, D, or A${C_RESET}"
        ;;
    esac
  done
}

_show_error_details() {
  echo -e "${C_DIM}──────── last error output ────────${C_RESET}"
  if [[ -n "${BABY_LAST_ERROR_LOG}" && -f "${BABY_LAST_ERROR_LOG}" ]]; then
    # last 40 lines
    tail -n 40 "${BABY_LAST_ERROR_LOG}" | sed 's/^/  /'
  elif [[ -n "${BABY_LAST_ERROR}" ]]; then
    echo "$BABY_LAST_ERROR" | sed 's/^/  /'
  else
    echo "  (no captured output — check $LOG_FILE)"
  fi
  echo -e "${C_DIM}───────────────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}Full install log: ${LOG_FILE}${C_RESET}"
  echo
}

# ── Core: try_step "label" cmd [args...] ────────────────────────────────────
# Runs command; on failure prompts retry/skip/abort.
# Returns 0 on success or skip; exits on abort.
# Does NOT use set -e around the command.
try_step() {
  local label="$1"
  shift
  if [[ $# -eq 0 ]]; then
    err "try_step: no command for '$label'"
    return 1
  fi

  ((BABY_STEP_COUNT++)) || true
  local attempt=0
  local max_auto_retry=1
  local auto_retried=0
  local rc=0
  local err_file=""
  local _prev_in_try=0

  while true; do
    ((attempt++)) || true
    err_file="$(mktemp "${TMPDIR:-/tmp}/baby-step.XXXXXX")"
    BABY_LAST_ERROR_LOG="$err_file"

    echo -e "  ${C_DIM}┌─${C_RESET} ${C_BOLD}${label}${C_RESET} ${C_DIM}(step ${BABY_STEP_COUNT}, try ${attempt})${C_RESET}"

    set +e
    set -o pipefail
    # Prevent nested try_step wrappers (e.g. raw binary inside github release)
    _prev_in_try="${BABY_IN_TRY_STEP:-0}"
    export BABY_IN_TRY_STEP=1
    # Live output + capture for error report
    "$@" 2>&1 | tee -a "$err_file"
    # CRITICAL: read PIPESTATUS immediately — any other command (even `local`) clobbers it
    rc=${PIPESTATUS[0]:-1}
    BABY_IN_TRY_STEP="$_prev_in_try"
    export BABY_IN_TRY_STEP
    set +o pipefail
    set -e

    if [[ $rc -eq 0 ]]; then
      echo -e "  ${C_BRIGHT_GREEN}└─ ✓ OK${C_RESET}  ${label}"
      record_ok "$label" "attempt=$attempt"
      rm -f "$err_file" 2>/dev/null || true
      return 0
    fi

    # Failure
    BABY_LAST_ERROR="$(tail -n 12 "$err_file" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g')"
    _print_fail_box "$label" "$attempt" "$rc" "$BABY_LAST_ERROR"
    log "STEP FAIL rc=$rc label=$label"
    log "STEP ERR $(echo "$BABY_LAST_ERROR" | tr '\n' ' ')"

    # Non-interactive: one auto-retry then skip (or as configured)
    if [[ "${ASSUME_YES:-0}" == "1" && "${BABY_ON_FAIL}" == "retry_once" && $auto_retried -lt $max_auto_retry ]]; then
      ((auto_retried++)) || true
      warn "Auto-retry ($auto_retried/$max_auto_retry)…"
      sleep 1
      continue
    fi

    ask_fail_action "$label"
    case "$REPLY_FAIL_ACTION" in
      retry)
        info "Retrying: $label"
        continue
        ;;
      details)
        _show_error_details
        # ask again without re-running
        ask_fail_action "$label"
        case "$REPLY_FAIL_ACTION" in
          retry) continue ;;
          skip)
            record_skip "$label" "failed rc=$rc; user skipped after details"
            rm -f "$err_file" 2>/dev/null || true
            return 0
            ;;
          abort)
            record_fail "$label" "aborted by user rc=$rc"
            BABY_ABORT_REQUESTED=1
            print_install_report
            die "Installation aborted by user at: $label"
            ;;
          details)
            _show_error_details
            record_skip "$label" "failed rc=$rc; skipped after viewing details"
            rm -f "$err_file" 2>/dev/null || true
            return 0
            ;;
        esac
        ;;
      skip)
        record_skip "$label" "failed rc=$rc; user skipped"
        # keep error file path in state for report
        _record_line "${BABY_STATE}/failed.txt" "SOFT-FAIL (skipped): ${label} rc=${rc}"
        rm -f "$err_file" 2>/dev/null || true
        return 0
        ;;
      abort)
        record_fail "$label" "aborted by user rc=$rc"
        BABY_ABORT_REQUESTED=1
        print_install_report
        die "Installation aborted by user at: $label"
        ;;
    esac
  done
}

# try_step for bash functions / complex blocks:
#   try_fn "label" my_function arg1 arg2
# same as try_step
try_fn() { try_step "$@"; }

# Soft try: on failure always skip (no prompt) — for optional tools
try_optional() {
  local label="$1"
  shift
  ((BABY_STEP_COUNT++)) || true
  local err_file
  err_file="$(mktemp "${TMPDIR:-/tmp}/baby-opt.XXXXXX")"
  echo -e "  ${C_DIM}· optional:${C_RESET} ${label}"
  local rc=0
  set +e
  set -o pipefail
  "$@" 2>&1 | tee -a "$err_file"
  rc=${PIPESTATUS[0]:-1}
  set +o pipefail
  set -e
  if [[ $rc -eq 0 ]]; then
    echo -e "  ${C_GREEN}  ✓${C_RESET} $label"
    record_ok "$label" "optional"
    rm -f "$err_file"
    return 0
  fi
  local snip
  snip="$(tail -n 3 "$err_file" 2>/dev/null | tr '\n' ' ')"
  record_skip "$label" "optional failed rc=$rc ${snip:0:80}"
  rm -f "$err_file"
  return 0
}

# Run a whole module with outer safety net (uncaught errors)
run_module_safe() {
  local name="$1"
  shift
  local fn="$1"

  header "Module: ${name}"
  echo -e "  ${C_DIM}Failure policy: retry / skip / abort on each step${C_RESET}"
  echo

  set +e
  "$fn"
  local rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    err "Module '${name}' returned exit code $rc"
    if [[ "${ASSUME_YES:-0}" == "1" ]]; then
      record_skip "module:${name}" "module exited $rc (auto-skip)"
      return 0
    fi
    _print_fail_box "module:${name}" "1" "$rc" "Module function returned non-zero"
    ask_fail_action "module:${name}"
    case "$REPLY_FAIL_ACTION" in
      retry)
        info "Re-running module: $name"
        set +e
        "$fn"
        rc=$?
        set -e
        if [[ $rc -eq 0 ]]; then
          record_ok "module:${name}" "ok after retry"
          return 0
        fi
        record_skip "module:${name}" "still failing after retry rc=$rc"
        ;;
      skip | details)
        record_skip "module:${name}" "module exited $rc; user skipped"
        ;;
      abort)
        record_fail "module:${name}" "aborted"
        print_install_report
        die "Aborted during module: $name"
        ;;
    esac
  else
    record_ok "module:${name}" "completed"
  fi
}

# Enhanced verify_tools that records missing
verify_tools_tracked() {
  local group="$1"
  shift
  local okc=0 miss=0
  local c
  echo
  echo -e "${C_BOLD}${C_CYAN}══ verify: ${group} ══${C_RESET}"
  for c in "$@"; do
    if have_cmd "$c"; then
      echo -e "  ${C_BRIGHT_GREEN}✓${C_RESET}  ${c}  ${C_DIM}$(command -v "$c")${C_RESET}"
      ((okc++)) || true
    else
      echo -e "  ${C_BRIGHT_RED}✗${C_RESET}  ${c}  ${C_DIM}not on PATH${C_RESET}"
      record_missing_cmd "$c" "$group"
      ((miss++)) || true
    fi
  done
  echo -e "  ${C_DIM}${okc} present · ${miss} missing${C_RESET}"
}

# ── Final report ────────────────────────────────────────────────────────────
print_install_report() {
  local report="${BABY_STATE}/install-report.txt"
  local now
  now="$(date -Iseconds)"

  {
    echo "Baby Linux install report"
    echo "started:  ${BABY_RUN_STARTED:-unknown}"
    echo "finished: $now"
    echo "user:     $USER@$HOSTNAME"
    echo "distro:   ${DISTRO_NAME:-unknown} (${PM:-?})"
    echo
    echo "counts: ok=${BABY_STEP_OK} skipped=${BABY_STEP_SKIP} failed=${BABY_STEP_FAIL} steps=${BABY_STEP_COUNT}"
    echo
    echo "=== SKIPPED (retry these manually) ==="
    if [[ ${#BABY_SKIP_ITEMS[@]} -eq 0 ]]; then
      echo "(none)"
    else
      local item
      for item in "${BABY_SKIP_ITEMS[@]}"; do
        echo " - ${item//|/ — }"
      done
    fi
    echo
    echo "=== HARD FAILURES / ABORTS ==="
    if [[ ${#BABY_FAIL_ITEMS[@]} -eq 0 ]]; then
      echo "(none)"
    else
      for item in "${BABY_FAIL_ITEMS[@]}"; do
        echo " - ${item//|/ — }"
      done
    fi
    echo
    echo "=== MISSING COMMANDS (expected on PATH but not found) ==="
    if [[ ! -s "${BABY_STATE}/missing-commands.txt" ]]; then
      echo "(none checked or all present)"
    else
      sort -u "${BABY_STATE}/missing-commands.txt" | sed 's/^/ - /'
    fi
    echo
    echo "=== OK (sample last 30) ==="
    tail -n 30 "${BABY_STATE}/ok.txt" 2>/dev/null | sed 's/^/ - /' || echo "(none)"
    echo
    echo "log: $LOG_FILE"
  } >"$report"

  # Colourful terminal summary
  echo
  echo -e "${C_BOLD}${C_MAGENTA}╔══════════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}║${C_RESET}  ${C_BOLD}${C_BRIGHT_WHITE}INSTALL REPORT${C_RESET}                                              ${C_BOLD}${C_MAGENTA}║${C_RESET}"
  echo -e "${C_BOLD}${C_MAGENTA}╚══════════════════════════════════════════════════════════════╝${C_RESET}"
  echo
  echo -e "  ${C_BRIGHT_GREEN}✓  Succeeded${C_RESET}  ${C_BOLD}${BABY_STEP_OK}${C_RESET}"
  echo -e "  ${C_BRIGHT_YELLOW}⊘  Skipped${C_RESET}    ${C_BOLD}${BABY_STEP_SKIP}${C_RESET}"
  echo -e "  ${C_BRIGHT_RED}✗  Failed${C_RESET}     ${C_BOLD}${BABY_STEP_FAIL}${C_RESET}"
  echo -e "  ${C_DIM}   Steps run   ${BABY_STEP_COUNT}${C_RESET}"
  echo

  if [[ ${#BABY_SKIP_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_BRIGHT_YELLOW}${C_BOLD}  Skipped items (install / fix manually later):${C_RESET}"
    local i=1
    local item label detail
    for item in "${BABY_SKIP_ITEMS[@]}"; do
      label="${item%%|*}"
      detail="${item#*|}"
      printf "  %s%2d.%s %s%s%s\n" "$C_YELLOW" "$i" "$C_RESET" "$C_BOLD" "$label" "$C_RESET"
      [[ -n "$detail" && "$detail" != "$item" ]] && echo -e "      ${C_DIM}${detail}${C_RESET}"
      ((i++)) || true
    done
    echo
  fi

  if [[ ${#BABY_FAIL_ITEMS[@]} -gt 0 ]]; then
    echo -e "${C_BRIGHT_RED}${C_BOLD}  Hard failures:${C_RESET}"
    for item in "${BABY_FAIL_ITEMS[@]}"; do
      echo -e "    ${C_RED}•${C_RESET} ${item//|/ — }"
    done
    echo
  fi

  if [[ -s "${BABY_STATE}/missing-commands.txt" ]]; then
    echo -e "${C_ORANGE}${C_BOLD}  Commands still missing from PATH:${C_RESET}"
    sort -u "${BABY_STATE}/missing-commands.txt" | while read -r line; do
      echo -e "    ${C_RED}✗${C_RESET}  $line"
    done
    echo
    echo -e "  ${C_DIM}Tip: re-run a module after fixing network/repos:${C_RESET}"
    echo -e "  ${C_CYAN}./install.sh --modules devops,sre,cloud,security${C_RESET}"
    echo
  fi

  if [[ ${#BABY_SKIP_ITEMS[@]} -eq 0 && ${#BABY_FAIL_ITEMS[@]} -eq 0 && ! -s "${BABY_STATE}/missing-commands.txt" ]]; then
    echo -e "  ${C_BRIGHT_GREEN}${C_BOLD}All tracked steps completed cleanly. Nice.${C_RESET}"
    echo
  else
    echo -e "  ${C_BOLD}Manual recovery cheatsheet${C_RESET}"
    echo -e "  ${C_DIM}────────────────────────────────────────────${C_RESET}"
    echo -e "  Full report : ${C_CYAN}${report}${C_RESET}"
    echo -e "  Skipped log : ${C_CYAN}${BABY_STATE}/skipped.txt${C_RESET}"
    echo -e "  Failed log  : ${C_CYAN}${BABY_STATE}/failed.txt${C_RESET}"
    echo -e "  Install log : ${C_CYAN}${LOG_FILE}${C_RESET}"
    echo -e "  Missing cmds: ${C_CYAN}${BABY_STATE}/missing-commands.txt${C_RESET}"
    echo
    echo -e "  ${C_DIM}Examples to fix by hand:${C_RESET}"
    echo -e "    ${C_GREEN}sudo pacman -S <package>${C_RESET}   or  ${C_GREEN}sudo apt install <package>${C_RESET}"
    echo -e "    ${C_GREEN}yay -S <aur-package>${C_RESET}"
    echo -e "    ${C_GREEN}./install.sh --modules <module>${C_RESET}   # re-run just that module"
    echo
  fi

  ok "Report written → $report"
}

# Progress line between modules
progress_bar() {
  local current="$1"
  local total="$2"
  local name="$3"
  local width=30
  local filled=0
  if ((total > 0)); then
    filled=$((current * width / total))
  fi
  local bar=""
  local i
  for ((i = 0; i < width; i++)); do
    if ((i < filled)); then
      bar+="█"
    else
      bar+="░"
    fi
  done
  echo -e "  ${C_MAGENTA}[${bar}]${C_RESET} ${C_BOLD}${current}/${total}${C_RESET}  ${C_CYAN}${name}${C_RESET}"
}
