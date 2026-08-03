#!/usr/bin/env bash
# Terminal colors for Grounds CLI

if [[ -t 1 ]] && [[ "${NO_COLOR:-}" != "1" ]]; then
  export C_RESET=$'\033[0m'
  export C_BOLD=$'\033[1m'
  export C_DIM=$'\033[2m'
  export C_RED=$'\033[31m'
  export C_GREEN=$'\033[32m'
  export C_YELLOW=$'\033[33m'
  export C_BLUE=$'\033[34m'
  export C_MAGENTA=$'\033[35m'
  export C_CYAN=$'\033[36m'
  export C_WHITE=$'\033[37m'
  export C_BG_BLUE=$'\033[44m'
else
  export C_RESET= C_BOLD= C_DIM= C_RED= C_GREEN= C_YELLOW=
  export C_BLUE= C_MAGENTA= C_CYAN= C_WHITE= C_BG_BLUE=
fi

info()    { printf '%sℹ%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }
ok()      { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()    { printf '%s⚠%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()     { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
header()  { printf '\n%s%s══ %s ══%s\n' "$C_BOLD" "$C_BLUE" "$*" "$C_RESET"; }
title()   { printf '%s%s%s\n' "$C_BOLD" "$*" "$C_RESET"; }
dim()     { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }
