#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
kubectl --context kind-grounds delete deploy web-backend svc web-backend --ignore-not-found >/dev/null 2>&1 || true
cat <<'YAML' | kubectl --context kind-grounds apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-backend
  template:
    metadata:
      labels:
        app: web-backend
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports: [{containerPort: 80}]
---
apiVersion: v1
kind: Service
metadata:
  name: web-backend
spec:
  selector:
    app: web-backend-typo
  ports:
    - port: 80
      targetPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-014 — Service has no endpoints

Service web-backend selects the wrong labels. Fix selector so endpoints populate.
EOF
ok "Fix service selector"
