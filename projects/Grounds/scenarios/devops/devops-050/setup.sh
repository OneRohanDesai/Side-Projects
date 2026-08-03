#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/deploy.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nimbus-limited
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nimbus-limited
  template:
    metadata:
      labels:
        app: nimbus-limited
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
YAML
kubectl --context kind-grounds apply -f "$WORKSPACE/deploy.yaml" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-050 — Kubernetes Resource Limit Configuration

Patch deployment nimbus-limited so the container has:
- requests: cpu 50m, memory 64Mi
- limits: cpu 200m, memory 128Mi
EOF
ok "Add resource requests/limits"
