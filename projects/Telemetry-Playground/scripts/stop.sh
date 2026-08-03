#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-telemetry-playground}"

echo "========================================"
echo "Stopping Telemetry Playground"
echo "========================================"

echo
echo "Stopping port-forwards..."
pkill -f "kubectl port-forward" >/dev/null 2>&1 || true

echo
echo "Checking for Kind cluster..."
if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "Deleting Kind cluster..."
  kind delete cluster --name "${CLUSTER_NAME}"
else
  echo "Cluster not found."
fi

echo
echo "Removing local playground images..."
docker rmi \
  "telemetry-generator:local" \
  "telemetry-receiver:local" \
  "telemetry-dashboard:local" \
  "telemetry-nginx:local" \
  >/dev/null 2>&1 || true

echo
echo "Pruning dangling Docker images..."
docker image prune -f >/dev/null 2>&1 || true

echo
echo "========================================"
echo "Telemetry Playground Stopped"
echo "========================================"
