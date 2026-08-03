#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# ensure kind is up done by needs; copy manifests
cp -r "${GROUNDS_ROOT}/app/nimbus/k8s" "$WORKSPACE/"
# broken: wrong image pull policy scenario — student deploys a simple pod
cat >"$WORKSPACE/pod.yaml" <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: nimbus-trainer
  namespace: default
  labels:
    app: nimbus-trainer
spec:
  containers:
    - name: trainer
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-048 — Kubernetes Pod Deployment

Using Kind context kind-grounds:
1. kubectl apply -f pod.yaml
2. Wait until Pod nimbus-trainer is Running
3. Save `kubectl get pod nimbus-trainer -o wide` to pod-status.txt
EOF
ok "Deploy pod nimbus-trainer on Kind"
