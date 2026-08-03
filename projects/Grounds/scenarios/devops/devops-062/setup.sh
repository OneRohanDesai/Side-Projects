#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-062 — Kubernetes Secret Management

1. Create secret `nimbus-db` with keys username=nimbus password=s3cr3t
2. Create a pod `secret-consumer` that mounts the secret as env vars
3. Pod should use nginx:alpine and be Running
EOF
ok "Create and consume a K8s secret"
