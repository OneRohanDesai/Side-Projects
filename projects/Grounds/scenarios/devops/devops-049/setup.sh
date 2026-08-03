#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/deploy.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nimbus-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nimbus-web
  template:
    metadata:
      labels:
        app: nimbus-web
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-049 — Kubernetes Deployment Management

1. Apply deploy.yaml
2. Scale nimbus-web to 3 replicas
3. Expose it as ClusterIP service port 80
EOF
ok "Manage Deployment nimbus-web"
