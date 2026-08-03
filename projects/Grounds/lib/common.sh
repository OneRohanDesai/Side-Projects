#!/usr/bin/env bash
# Shared helpers for Grounds

set -euo pipefail

GROUNDS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export GROUNDS_ROOT
export GROUNDS_STATE="${GROUNDS_ROOT}/state"
export GROUNDS_PROGRESS="${GROUNDS_ROOT}/progress/progress.json"
export GROUNDS_CATALOG="${GROUNDS_ROOT}/scenarios/catalog.json"
export GROUNDS_ACTIVE="${GROUNDS_STATE}/active.json"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-grounds}"
# Per-stack project names avoid orphan-container warnings across compose files
compose_project() {
  local stack="$1"
  echo "grounds-${stack}"
}

# shellcheck source=/dev/null
source "${GROUNDS_ROOT}/lib/colors.sh"

mkdir -p "${GROUNDS_STATE}" "${GROUNDS_ROOT}/progress" \
  "${GROUNDS_STATE}/logs" "${GROUNDS_STATE}/workspaces"

require_cmd() {
  local c
  for c in "$@"; do
    if ! command -v "$c" >/dev/null 2>&1; then
      err "Missing required command: $c"
      return 1
    fi
  done
}

# Safe JSON get with jq; prints empty on miss
json_get() {
  local file="$1" query="$2"
  if [[ ! -f "$file" ]]; then
    echo ""
    return 0
  fi
  jq -r "$query // empty" "$file" 2>/dev/null || true
}

ensure_progress_file() {
  if [[ ! -f "$GROUNDS_PROGRESS" ]]; then
    echo '{"completed":{},"attempts":{},"last_active":null}' >"$GROUNDS_PROGRESS"
  fi
}

ensure_catalog() {
  if [[ ! -f "$GROUNDS_CATALOG" ]]; then
    err "Scenario catalog missing at $GROUNDS_CATALOG"
    err "Run: tools/generate-catalog.py"
    return 1
  fi
}

# Export AWS-compatible env for LocalStack
export_localstack_env() {
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
  export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"
  export AWS_PAGER=""
}

aws_local() {
  export_localstack_env
  if command -v aws >/dev/null 2>&1; then
    aws --endpoint-url="$AWS_ENDPOINT_URL" "$@"
  else
    # Fall back to dockerized aws-cli
    docker run --rm --network host \
      -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
      amazon/aws-cli:2.15.0 --endpoint-url="$AWS_ENDPOINT_URL" "$@"
  fi
}

confirm() {
  local prompt="${1:-Continue?}"
  local reply
  read -r -p "$(printf '%s%s [y/N]: %s' "$C_YELLOW" "$prompt" "$C_RESET")" reply || true
  [[ "${reply,,}" == "y" || "${reply,,}" == "yes" ]]
}

pause() {
  read -r -p "$(printf '%sPress Enter to continue…%s' "$C_DIM" "$C_RESET")" _ || true
}

log_file() {
  local name="${1:-grounds}"
  echo "${GROUNDS_STATE}/logs/${name}-$(date +%Y%m%d-%H%M%S).log"
}

workspace_for() {
  local id="$1"
  local dir="${GROUNDS_STATE}/workspaces/${id}"
  mkdir -p "$dir"
  echo "$dir"
}

# Compose helper relative to a stack dir
# Usage: compose_up <stack_dir> [stack_name] [compose args...]
compose_up() {
  local stack_dir="$1"
  shift
  local pname="$COMPOSE_PROJECT_NAME"
  if [[ -n "${1:-}" && "$1" != -* && "$1" != "--" ]]; then
    pname="$(compose_project "$1")"
    shift
  fi
  (cd "$stack_dir" && docker compose --project-name "$pname" up -d "$@")
}

compose_down() {
  local stack_dir="$1"
  shift || true
  local pname="$COMPOSE_PROJECT_NAME"
  if [[ -n "${1:-}" && "$1" != -* && "$1" != "-v" ]]; then
    pname="$(compose_project "$1")"
    shift
  fi
  (cd "$stack_dir" && docker compose --project-name "$pname" down --remove-orphans "$@" 2>/dev/null || true)
}

compose_ps() {
  local stack_dir="$1"
  local stack_name="${2:-}"
  local pname="$COMPOSE_PROJECT_NAME"
  [[ -n "$stack_name" ]] && pname="$(compose_project "$stack_name")"
  (cd "$stack_dir" && docker compose --project-name "$pname" ps)
}

is_port_open() {
  local port="$1"
  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

wait_http() {
  local url="$1" tries="${2:-30}" sleep_s="${3:-2}"
  local i
  for ((i = 1; i <= tries; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_s"
  done
  return 1
}

banner() {
  cat <<'EOF'
   ____                      _
  / ___|_ __ ___  _   _ _ __ | | __
 | |  _| '__/ _ \| | | | '_ \| |/ /
 | |_| | | | (_) | |_| | | | |   <
  \____|_|  \___/ \__,_|_| |_|_|\_\
EOF
  printf '%s  Local Cloud · DevOps · SRE Practice Arena%s\n' "$C_DIM" "$C_RESET"
  printf '%s  Zero cloud spend · Docker + Kind + LocalStack%s\n\n' "$C_DIM" "$C_RESET"
}
