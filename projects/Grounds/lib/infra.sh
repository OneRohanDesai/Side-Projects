#!/usr/bin/env bash
# Infrastructure lifecycle: start/stop stacks per scenario needs

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

STACKS_DIR="${GROUNDS_ROOT}/stacks"

# ── Stack: LocalStack (AWS APIs locally) ────────────────────────────────────
stack_localstack_up() {
  header "Starting LocalStack (AWS locally)"
  compose_up "${STACKS_DIR}/localstack" localstack
  info "Waiting for LocalStack health…"
  local i
  for ((i = 1; i <= 40; i++)); do
    if curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then
      ok "LocalStack ready → http://localhost:4566"
      export_localstack_env
      return 0
    fi
    sleep 2
  done
  err "LocalStack did not become healthy in time"
  return 1
}

stack_localstack_down() {
  compose_down "${STACKS_DIR}/localstack" localstack -v
}

# ── Stack: Nimbus production app ────────────────────────────────────────────
stack_nimbus_up() {
  header "Starting Nimbus production stack"
  compose_up "${STACKS_DIR}/nimbus" nimbus
  info "Waiting for API health…"
  if wait_http "http://localhost:8080/health" 40 2; then
    ok "Nimbus API  → http://localhost:8080"
    ok "Nimbus Web  → http://localhost:3000"
    ok "Nimbus Nginx→ http://localhost:8088"
  else
    warn "Nimbus may still be starting — check: grounds status"
  fi
}

stack_nimbus_down() {
  compose_down "${STACKS_DIR}/nimbus" nimbus -v
}

# ── Stack: Linux practice lab (privileged container) ────────────────────────
stack_linux_up() {
  header "Starting Linux practice lab"
  compose_up "${STACKS_DIR}/linux-lab" linux
  ok "Lab container: grounds-linux-lab"
  info "Enter with: docker exec -it grounds-linux-lab bash"
}

stack_linux_down() {
  compose_down "${STACKS_DIR}/linux-lab" linux -v
}

# ── Stack: Git bare repos lab ───────────────────────────────────────────────
stack_git_up() {
  header "Starting Git lab"
  compose_up "${STACKS_DIR}/git-lab" git
  ok "Git lab ready — workspace under state/workspaces/"
}

stack_git_down() {
  compose_down "${STACKS_DIR}/git-lab" git -v
}

# ── Stack: Jenkins ──────────────────────────────────────────────────────────
stack_jenkins_up() {
  header "Starting Jenkins"
  compose_up "${STACKS_DIR}/jenkins" jenkins
  info "Waiting for Jenkins…"
  if wait_http "http://localhost:18080/login" 60 3; then
    ok "Jenkins → http://localhost:18080  (admin / grounds)"
  else
    warn "Jenkins is slow on first boot; check logs"
  fi
}

stack_jenkins_down() {
  compose_down "${STACKS_DIR}/jenkins" jenkins -v
}

# ── Stack: Kind Kubernetes cluster ──────────────────────────────────────────
stack_kind_up() {
  header "Starting Kind Kubernetes cluster"
  require_cmd kind kubectl
  if kind get clusters 2>/dev/null | grep -qx 'grounds'; then
    ok "Kind cluster 'grounds' already exists"
  else
    kind create cluster --name grounds --config "${STACKS_DIR}/kind/kind-config.yaml"
  fi
  kubectl cluster-info --context kind-grounds >/dev/null
  # Local registry + load nimbus image if present
  if docker image inspect grounds-nimbus-api:latest >/dev/null 2>&1; then
    kind load docker-image grounds-nimbus-api:latest --name grounds 2>/dev/null || true
  fi
  ok "kubectl context: kind-grounds"
}

stack_kind_down() {
  if kind get clusters 2>/dev/null | grep -qx 'grounds'; then
    if confirm "Delete Kind cluster 'grounds'?"; then
      kind delete cluster --name grounds
    fi
  else
    info "No Kind cluster named grounds"
  fi
}

# ── Stack: Ansible lab targets ──────────────────────────────────────────────
stack_ansible_up() {
  header "Starting Ansible target hosts"
  compose_up "${STACKS_DIR}/ansible-lab" ansible
  ok "Targets: app01, app02, db01 (ssh via docker exec or mapped ports)"
}

stack_ansible_down() {
  compose_down "${STACKS_DIR}/ansible-lab" ansible -v
}

# Map need → start function
infra_start_need() {
  local need="$1"
  case "$need" in
    localstack) stack_localstack_up ;;
    nimbus)     stack_nimbus_up ;;
    linux)      stack_linux_up ;;
    git)        stack_git_up ;;
    jenkins)    stack_jenkins_up ;;
    kind|k8s)   stack_kind_up ;;
    ansible)    stack_ansible_up ;;
    docker)     require_cmd docker; ok "Docker engine available" ;;
    none|"")    info "No extra infra required" ;;
    *)          warn "Unknown infra need: $need (skipped)" ;;
  esac
}

infra_stop_need() {
  local need="$1"
  case "$need" in
    localstack) stack_localstack_down ;;
    nimbus)     stack_nimbus_down ;;
    linux)      stack_linux_down ;;
    git)        stack_git_down ;;
    jenkins)    stack_jenkins_down ;;
    kind|k8s)   stack_kind_down ;;
    ansible)    stack_ansible_down ;;
    *)          : ;;
  esac
}

# Start all needs listed as JSON array string e.g. '["localstack","nimbus"]'
infra_start_for_scenario() {
  local needs_json="$1"
  local need
  while IFS= read -r need; do
    [[ -z "$need" ]] && continue
    infra_start_need "$need"
  done < <(echo "$needs_json" | jq -r '.[]' 2>/dev/null || true)
}

infra_status() {
  header "Infrastructure status"
  echo
  printf '  %-14s ' "Docker"; docker info >/dev/null 2>&1 && ok "running" || err "not running"
  printf '  %-14s ' "LocalStack"
  if curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; then ok "up :4566"; else dim "down"; fi
  printf '  %-14s ' "Nimbus API"
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then ok "up :8080"; else dim "down"; fi
  printf '  %-14s ' "Jenkins"
  if curl -sf http://localhost:18080/login >/dev/null 2>&1; then ok "up :18080"; else dim "down"; fi
  printf '  %-14s ' "Kind"
  if kind get clusters 2>/dev/null | grep -qx grounds; then ok "cluster grounds"; else dim "no cluster"; fi
  printf '  %-14s ' "Linux lab"
  if docker ps --format '{{.Names}}' | grep -qx grounds-linux-lab; then ok "running"; else dim "down"; fi
  echo
  if [[ -f "$GROUNDS_ACTIVE" ]]; then
    local aid atitle
    aid="$(json_get "$GROUNDS_ACTIVE" '.id')"
    atitle="$(json_get "$GROUNDS_ACTIVE" '.title')"
    info "Active scenario: ${aid} — ${atitle}"
  else
    dim "No active scenario"
  fi
  echo
}

infra_stop_all() {
  header "Stopping all Grounds stacks"
  stack_nimbus_down
  stack_localstack_down
  stack_linux_down
  stack_git_down
  stack_jenkins_down
  stack_ansible_down
  info "Kind cluster left running (delete with: grounds infra down kind)"
  ok "Done"
}
