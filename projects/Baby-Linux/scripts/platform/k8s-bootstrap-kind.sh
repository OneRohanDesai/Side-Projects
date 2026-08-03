#!/usr/bin/env bash
# Spin a local multi-node kind cluster with ingress-ready labels
set -euo pipefail

CLUSTER_NAME="${1:-baby}"
cat <<EOF | kind create cluster --name "$CLUSTER_NAME" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
  - role: worker
EOF

kubectl cluster-info
kubectl get nodes -o wide
echo "Cluster '$CLUSTER_NAME' ready. Delete with: kind delete cluster --name $CLUSTER_NAME"
