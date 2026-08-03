#!/usr/bin/env bash
# Progress tracking for completed scenarios

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

progress_mark_attempt() {
  local id="$1"
  ensure_progress_file
  local tmp
  tmp="$(mktemp)"
  jq --arg id "$id" --arg ts "$(date -Iseconds)" '
    .attempts[$id] = ((.attempts[$id] // 0) + 1)
    | .last_active = $id
    | .last_attempt_at = $ts
  ' "$GROUNDS_PROGRESS" >"$tmp" && mv "$tmp" "$GROUNDS_PROGRESS"
}

progress_mark_complete() {
  local id="$1"
  ensure_progress_file
  local tmp
  tmp="$(mktemp)"
  jq --arg id "$id" --arg ts "$(date -Iseconds)" '
    .completed[$id] = $ts
    | .last_active = $id
  ' "$GROUNDS_PROGRESS" >"$tmp" && mv "$tmp" "$GROUNDS_PROGRESS"
  ok "Marked complete: $id"
}

progress_is_complete() {
  local id="$1"
  ensure_progress_file
  local v
  v="$(jq -r --arg id "$id" '.completed[$id] // empty' "$GROUNDS_PROGRESS")"
  [[ -n "$v" ]]
}

progress_stats() {
  ensure_progress_file
  ensure_catalog
  local total done aws_total devops_total sad_total aws_done devops_done sad_done
  total="$(jq '.scenarios | length' "$GROUNDS_CATALOG")"
  done="$(jq '.completed | length' "$GROUNDS_PROGRESS")"
  aws_total="$(jq '[.scenarios[] | select(.track=="aws")] | length' "$GROUNDS_CATALOG")"
  devops_total="$(jq '[.scenarios[] | select(.track=="devops")] | length' "$GROUNDS_CATALOG")"
  sad_total="$(jq '[.scenarios[] | select(.track=="sadservers")] | length' "$GROUNDS_CATALOG")"
  # Use process substitution to join progress + catalog (jq --argfile removed in new jq)
  aws_done="$(jq -r -n --slurpfile p "$GROUNDS_PROGRESS" --slurpfile c "$GROUNDS_CATALOG" '
    [ $p[0].completed | keys[] as $k
      | ($c[0].scenarios[] | select(.id==$k) | .track)
      | select(.=="aws") ] | length
  ' 2>/dev/null || echo 0)"
  devops_done="$(jq -r -n --slurpfile p "$GROUNDS_PROGRESS" --slurpfile c "$GROUNDS_CATALOG" '
    [ $p[0].completed | keys[] as $k
      | ($c[0].scenarios[] | select(.id==$k) | .track)
      | select(.=="devops") ] | length
  ' 2>/dev/null || echo 0)"
  sad_done="$(jq -r -n --slurpfile p "$GROUNDS_PROGRESS" --slurpfile c "$GROUNDS_CATALOG" '
    [ $p[0].completed | keys[] as $k
      | ($c[0].scenarios[] | select(.id==$k) | .track)
      | select(.=="sadservers") ] | length
  ' 2>/dev/null || echo 0)"

  header "Progress"
  printf '  Overall : %s%d%s / %d\n' "$C_GREEN" "$done" "$C_RESET" "$total"
  printf '  AWS     : %s%d%s / %d  (LocalStack)\n' "$C_CYAN" "$aws_done" "$C_RESET" "$aws_total"
  printf '  DevOps  : %s%d%s / %d  (Linux/Git/Docker/K8s/Jenkins/Ansible/TF)\n' "$C_MAGENTA" "$devops_done" "$C_RESET" "$devops_total"
  printf '  SadServers: %s%d%s / %d  (troubleshooting)\n' "$C_YELLOW" "$sad_done" "$C_RESET" "$sad_total"
  echo
}

progress_reset() {
  if confirm "Reset ALL progress?"; then
    echo '{"completed":{},"attempts":{},"last_active":null}' >"$GROUNDS_PROGRESS"
    ok "Progress reset"
  fi
}
