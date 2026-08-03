#!/usr/bin/env bash
# Scenario load / start / verify / stop

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/progress.sh"
# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/infra.sh"

scenario_by_id() {
  local id="$1"
  ensure_catalog
  jq -c --arg id "$id" '.scenarios[] | select(.id==$id)' "$GROUNDS_CATALOG"
}

scenario_list() {
  local track="${1:-}" filter="${2:-}"
  ensure_catalog
  if [[ -n "$track" ]]; then
    jq -c --arg t "$track" --arg f "$filter" '
      .scenarios[]
      | select(.track==$t)
      | select(($f=="") or (.id|contains($f)) or (.title|ascii_downcase|contains($f|ascii_downcase)))
    ' "$GROUNDS_CATALOG"
  else
    jq -c --arg f "$filter" '
      .scenarios[]
      | select(($f=="") or (.id|contains($f)) or (.title|ascii_downcase|contains($f|ascii_downcase)))
    ' "$GROUNDS_CATALOG"
  fi
}

scenario_print_brief() {
  local json="$1"
  local id title difficulty status_icon
  id="$(echo "$json" | jq -r '.id')"
  title="$(echo "$json" | jq -r '.title')"
  difficulty="$(echo "$json" | jq -r '.difficulty // "medium"')"
  if progress_is_complete "$id"; then
    status_icon="${C_GREEN}✓${C_RESET}"
  else
    status_icon="${C_DIM}·${C_RESET}"
  fi
  printf '  %s  %s%-14s%s %s  %s(%s)%s\n' \
    "$status_icon" "$C_CYAN" "$id" "$C_RESET" "$title" "$C_DIM" "$difficulty" "$C_RESET"
}

scenario_dir() {
  local id="$1"
  local track path
  track="$(scenario_by_id "$id" | jq -r '.track')"
  path="${GROUNDS_ROOT}/scenarios/${track}/${id}"
  echo "$path"
}

scenario_show() {
  local id="$1"
  local sc dir
  sc="$(scenario_by_id "$id")"
  if [[ -z "$sc" ]]; then
    err "Unknown scenario: $id"
    return 1
  fi
  dir="$(scenario_dir "$id")"

  header "$(echo "$sc" | jq -r '.title')"
  echo "$sc" | jq -r '
    "  ID          : \(.id)",
    "  Track       : \(.track)",
    "  Difficulty  : \(.difficulty // "medium")",
    "  Infra needs : \(.needs | join(", "))",
    "  Skills      : \(.skills | join(", "))",
    "",
    "  Objective:",
    "  \(.objective)"
  '
  if [[ -f "${dir}/OBJECTIVE.md" ]]; then
    echo
    dim "── Full brief ──"
    cat "${dir}/OBJECTIVE.md"
  fi
  if [[ -f "${dir}/HINTS.md" ]]; then
    echo
    info "Hints available: grounds hint $id"
  fi
  echo
  local impl
  impl="$(echo "$sc" | jq -r '.implemented // false')"
  if [[ "$impl" == "true" ]]; then
    ok "Fully implemented (setup + verify)"
  else
    warn "Scaffolded scenario — guided brief + generic verify checklist"
  fi
}

scenario_start() {
  local id="$1"
  local sc dir needs ws
  sc="$(scenario_by_id "$id")"
  if [[ -z "$sc" ]]; then
    err "Unknown scenario: $id"
    return 1
  fi

  if [[ -f "$GROUNDS_ACTIVE" ]]; then
    local cur
    cur="$(json_get "$GROUNDS_ACTIVE" '.id')"
    if [[ "$cur" != "$id" ]]; then
      warn "Active scenario is $cur"
      if confirm "Stop it and start $id?"; then
        scenario_stop_quiet || true
      else
        return 1
      fi
    fi
  fi

  dir="$(scenario_dir "$id")"
  needs="$(echo "$sc" | jq -c '.needs')"
  ws="$(workspace_for "$id")"

  header "Starting scenario: $id"
  progress_mark_attempt "$id"

  # Bring up infra
  infra_start_for_scenario "$needs"

  # Run scenario-specific setup if present
  if [[ -x "${dir}/setup.sh" ]]; then
    info "Running scenario setup…"
    (
      export GROUNDS_ROOT GROUNDS_STATE
      export SCENARIO_ID="$id"
      export SCENARIO_DIR="$dir"
      export WORKSPACE="$ws"
      export_localstack_env
      # shellcheck disable=SC1091
      bash "${dir}/setup.sh"
    )
  elif [[ -f "${dir}/setup.sh" ]]; then
    bash "${dir}/setup.sh"
  else
    # Generic setup from catalog
    info "Applying generic prep for scaffolded scenario…"
    _generic_setup "$sc" "$ws"
  fi

  # Persist active state
  echo "$sc" | jq --arg ws "$ws" --arg ts "$(date -Iseconds)" \
    '. + {workspace:$ws, started_at:$ts}' >"$GROUNDS_ACTIVE"

  echo
  scenario_show "$id"
  header "How to solve"
  cat <<EOF
  1. Read the objective above carefully.
  2. Work in the workspace / lab containers (see brief).
  3. Production app source: ${GROUNDS_ROOT}/app/nimbus
  4. When ready:  ${C_BOLD}grounds verify${C_RESET}
  5. Stuck?       ${C_BOLD}grounds hint${C_RESET}
  6. Stop lab:    ${C_BOLD}grounds stop${C_RESET}

  Workspace: ${C_CYAN}${ws}${C_RESET}
EOF
  echo
}

_generic_setup() {
  local sc="$1" ws="$2"
  local track skills
  track="$(echo "$sc" | jq -r '.track')"
  skills="$(echo "$sc" | jq -r '.skills | join(", ")')"
  cat >"${ws}/README.md" <<EOF
# $(echo "$sc" | jq -r '.title')

**ID:** $(echo "$sc" | jq -r '.id')
**Track:** ${track}
**Skills:** ${skills}

## Objective
$(echo "$sc" | jq -r '.objective')

## Local tools
- Production app: \`app/nimbus\` (FastAPI + Postgres + Redis + Nginx)
- AWS (LocalStack): \`export AWS_ENDPOINT_URL=http://localhost:4566\`
- Kind cluster: \`kubectl --context kind-grounds\`
- Linux lab: \`docker exec -it grounds-linux-lab bash\`

## Suggested approach
1. Reproduce the problem environment (infra already started by Grounds).
2. Solve it the production way — scripts, IaC, or config commits under this workspace.
3. Capture notes in NOTES.md here.
4. Run \`grounds verify\`.
EOF
  ok "Workspace prepared at $ws"
}

scenario_verify() {
  local id sc dir ws
  if [[ -n "${1:-}" ]]; then
    id="$1"
  elif [[ -f "$GROUNDS_ACTIVE" ]]; then
    id="$(json_get "$GROUNDS_ACTIVE" '.id')"
  else
    err "No active scenario. Start one with: grounds start <id>"
    return 1
  fi

  sc="$(scenario_by_id "$id")"
  if [[ -z "$sc" ]]; then
    err "Unknown scenario: $id"
    return 1
  fi
  dir="$(scenario_dir "$id")"
  ws="$(workspace_for "$id")"

  header "Verifying: $id"
  local rc=0
  if [[ -x "${dir}/verify.sh" ]] || [[ -f "${dir}/verify.sh" ]]; then
    (
      export GROUNDS_ROOT GROUNDS_STATE
      export SCENARIO_ID="$id"
      export SCENARIO_DIR="$dir"
      export WORKSPACE="$ws"
      export_localstack_env
      bash "${dir}/verify.sh"
    ) || rc=$?
  else
    _generic_verify "$sc" "$ws" || rc=$?
  fi

  if [[ $rc -eq 0 ]]; then
    ok "VERIFICATION PASSED"
    progress_mark_complete "$id"
  else
    err "VERIFICATION FAILED (exit $rc)"
    info "Re-read the objective, check hints, try again."
  fi
  return $rc
}

_generic_verify() {
  local sc="$1" ws="$2"
  local checks=0 pass=0
  # Basic: workspace notes + any script/evidence
  if [[ -f "${ws}/NOTES.md" ]] || [[ -f "${ws}/solution.sh" ]] || [[ -f "${ws}/main.tf" ]] \
    || [[ -f "${ws}/playbook.yml" ]] || [[ -f "${ws}/Dockerfile" ]] || [[ -d "${ws}/.git" ]]; then
    ok "Found solution artifacts in workspace"
    pass=$((pass + 1))
  else
    warn "No solution artifacts yet (NOTES.md, solution.sh, main.tf, playbook.yml, …)"
  fi
  checks=$((checks + 1))

  # If nimbus is a need, check health
  if echo "$sc" | jq -e '.needs | index("nimbus")' >/dev/null 2>&1; then
    checks=$((checks + 1))
    if curl -sf http://localhost:8080/health >/dev/null; then
      ok "Nimbus API healthy"
      pass=$((pass + 1))
    else
      err "Nimbus API not healthy"
    fi
  fi

  if [[ $pass -ge 1 ]]; then
    warn "Scaffolded verify is soft — mark complete only if YOU believe you solved it."
    if confirm "Mark this scenario complete?"; then
      return 0
    fi
    return 1
  fi
  return 1
}

scenario_hint() {
  local id="${1:-}"
  if [[ -z "$id" && -f "$GROUNDS_ACTIVE" ]]; then
    id="$(json_get "$GROUNDS_ACTIVE" '.id')"
  fi
  [[ -z "$id" ]] && { err "Usage: grounds hint <id>"; return 1; }
  local dir level="${2:-1}"
  dir="$(scenario_dir "$id")"
  if [[ -f "${dir}/HINTS.md" ]]; then
    header "Hints for $id"
    # Show progressive hints separated by ---
    awk -v n="$level" '
      /^---$/ { c++; next }
      c < n { print }
      c >= n { exit }
    ' "${dir}/HINTS.md"
    dim "(request more: grounds hint $id $((level + 1)))"
  else
    local sc
    sc="$(scenario_by_id "$id")"
    header "Generic guidance"
    echo "$sc" | jq -r '.objective'
    cat <<'EOF'

General tips:
  • Prefer infrastructure-as-code / automation over one-off clicks
  • LocalStack emulates AWS — use --endpoint-url=http://localhost:4566
  • Kind is your local EKS stand-in
  • Keep solution scripts in the scenario workspace for verify
EOF
  fi
}

scenario_stop_quiet() {
  if [[ ! -f "$GROUNDS_ACTIVE" ]]; then
    return 0
  fi
  local id dir
  id="$(json_get "$GROUNDS_ACTIVE" '.id')"
  dir="$(scenario_dir "$id")"
  if [[ -f "${dir}/teardown.sh" ]]; then
    bash "${dir}/teardown.sh" || true
  fi
  rm -f "$GROUNDS_ACTIVE"
}

scenario_stop() {
  if [[ ! -f "$GROUNDS_ACTIVE" ]]; then
    info "No active scenario"
    return 0
  fi
  local id
  id="$(json_get "$GROUNDS_ACTIVE" '.id')"
  header "Stopping scenario $id"
  scenario_stop_quiet
  if confirm "Also stop running infra stacks?"; then
    infra_stop_all
  fi
  ok "Stopped"
}

scenario_shell() {
  # Drop into the most relevant environment for the active scenario
  if [[ ! -f "$GROUNDS_ACTIVE" ]]; then
    err "No active scenario"
    return 1
  fi
  local id needs
  id="$(json_get "$GROUNDS_ACTIVE" '.id')"
  needs="$(jq -r '.needs[]' "$GROUNDS_ACTIVE")"
  if echo "$needs" | grep -qx linux; then
    docker exec -it grounds-linux-lab bash
  elif echo "$needs" | grep -qxE 'kind|k8s'; then
    info "Opening shell with KUBECONFIG for kind-grounds"
    kubectl config use-context kind-grounds
    bash --rcfile <(echo "PS1='grounds-k8s> '; export KUBECONFIG")
  elif echo "$needs" | grep -qx localstack; then
    export_localstack_env
    info "AWS env pointed at LocalStack. Try: aws_local s3 ls"
    bash --rcfile <(echo "PS1='grounds-aws> '; source '${GROUNDS_ROOT}/lib/common.sh'")
  else
    local ws
    ws="$(json_get "$GROUNDS_ACTIVE" '.workspace')"
    cd "$ws" || exit 1
    bash --rcfile <(echo "PS1='grounds:${id}> '; cd '$ws'")
  fi
}
