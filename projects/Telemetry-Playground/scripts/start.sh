#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

CLUSTER_NAME="${CLUSTER_NAME:-telemetry-playground}"
ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
TELEMETRY_NAMESPACE="${TELEMETRY_NAMESPACE:-telemetry}"
OBSERVABILITY_NAMESPACE="${OBSERVABILITY_NAMESPACE:-observability}"
IMAGE_TAG="${IMAGE_TAG:-local}"
INSTALL_ARGOCD="${INSTALL_ARGOCD:-true}"
USE_HELM_DIRECT="${USE_HELM_DIRECT:-true}"

echo "========================================"
echo "Starting Telemetry Playground"
echo "========================================"
echo "Root: ${ROOT_DIR}"
echo

echo "Checking required tools..."
for cmd in kind kubectl docker helm; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: ${cmd} is not installed."
    exit 1
  fi
done

echo
echo "Checking for existing Kind cluster..."
if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "Existing cluster found. Deleting..."
  kind delete cluster --name "${CLUSTER_NAME}"
fi

echo
echo "Creating Kind cluster..."
kind create cluster \
  --name "${CLUSTER_NAME}" \
  --config kind-config.yaml

echo
echo "Labelling ingress node..."
kubectl label node \
  "${CLUSTER_NAME}-control-plane" \
  ingress-ready=true \
  --overwrite

echo
echo "Installing ingress-nginx..."
kubectl apply -f \
  https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.2/deploy/static/provider/kind/deploy.yaml

echo
echo "Waiting for ingress-nginx resources..."
# Pods are not created instantly after apply; wait for the Deployment first.
for _ in $(seq 1 90); do
  if kubectl get deployment/ingress-nginx-controller -n ingress-nginx >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! kubectl get deployment/ingress-nginx-controller -n ingress-nginx >/dev/null 2>&1; then
  echo "ERROR: ingress-nginx-controller deployment never appeared."
  kubectl get all -n ingress-nginx || true
  exit 1
fi

echo "Waiting for ingress controller rollout..."
kubectl rollout status deployment/ingress-nginx-controller \
  -n ingress-nginx \
  --timeout=300s

echo "Waiting for ingress controller pod Ready..."
kubectl wait \
  --namespace ingress-nginx \
  --for=condition=Ready \
  pod \
  -l app.kubernetes.io/component=controller \
  --timeout=300s

if [[ "${INSTALL_ARGOCD}" == "true" ]]; then
  echo
  echo "Installing ArgoCD..."
  kubectl create namespace "${ARGOCD_NAMESPACE}" \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl apply \
    --server-side \
    -n "${ARGOCD_NAMESPACE}" \
    -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

  echo "Waiting for ArgoCD server..."
  kubectl rollout status deployment/argocd-server \
    -n "${ARGOCD_NAMESPACE}" \
    --timeout=300s
fi

echo
echo "Building Docker images (tag=${IMAGE_TAG})..."
docker build -t "telemetry-generator:${IMAGE_TAG}" -f docker/generator/Dockerfile .
docker build -t "telemetry-receiver:${IMAGE_TAG}" -f docker/receiver/Dockerfile .
docker build -t "telemetry-dashboard:${IMAGE_TAG}" -f docker/dashboard/Dockerfile .
docker build -t "telemetry-nginx:${IMAGE_TAG}" -f docker/nginx/Dockerfile .

echo
echo "Loading images into Kind..."
kind load docker-image "telemetry-generator:${IMAGE_TAG}" --name "${CLUSTER_NAME}"
kind load docker-image "telemetry-receiver:${IMAGE_TAG}" --name "${CLUSTER_NAME}"
kind load docker-image "telemetry-dashboard:${IMAGE_TAG}" --name "${CLUSTER_NAME}"
kind load docker-image "telemetry-nginx:${IMAGE_TAG}" --name "${CLUSTER_NAME}"

if [[ "${USE_HELM_DIRECT}" == "true" ]]; then
  echo
  echo "Installing Observability stack via Helm..."
  helm upgrade --install observability \
    deploy/helm/observability \
    -n "${OBSERVABILITY_NAMESPACE}" \
    --create-namespace \
    --wait \
    --timeout 10m

  echo
  echo "Installing Telemetry Playground via Helm (values-local)..."
  helm upgrade --install telemetry-playground \
    deploy/helm/telemetry-playground \
    -n "${TELEMETRY_NAMESPACE}" \
    --create-namespace \
    -f deploy/helm/telemetry-playground/values.yaml \
    -f deploy/helm/telemetry-playground/values-local.yaml \
    --set "imageTag=${IMAGE_TAG}" \
    --wait \
    --timeout 10m
else
  echo
  echo "Waiting for Argo CD Application CRDs (GitOps-only path)..."
  kubectl wait --for=condition=Established crd/applications.argoproj.io --timeout=120s
fi

# Always register Argo CD Applications when Argo CD is installed so the UI
# is not empty. With USE_HELM_DIRECT=true the apps may show OutOfSync until
# you sync (or enable auto-sync) — that is expected for local image tags.
if [[ "${INSTALL_ARGOCD}" == "true" ]]; then
  echo
  echo "Configuring Argo CD for HTTP ingress (argocd.local)..."
  kubectl wait --for=condition=Established crd/applications.argoproj.io --timeout=120s

  # Serve UI over HTTP so ingress-nginx can expose it like grafana.local.
  kubectl patch configmap argocd-cmd-params-cm \
    -n "${ARGOCD_NAMESPACE}" \
    --type merge \
    -p '{"data":{"server.insecure":"true"}}' >/dev/null

  kubectl rollout restart deployment/argocd-server -n "${ARGOCD_NAMESPACE}"
  kubectl rollout status deployment/argocd-server -n "${ARGOCD_NAMESPACE}" --timeout=300s

  echo "Creating Argo CD Ingress (argocd.local)..."
  kubectl apply -f argocd/ingress.yaml

  echo "Registering Argo CD Applications..."
  kubectl apply -f argocd/application.yaml
  kubectl apply -f argocd/observability-application.yaml
  echo "Argo CD Applications:"
  kubectl get applications -n "${ARGOCD_NAMESPACE}" -o wide 2>/dev/null || true
fi

echo
echo "Waiting for Telemetry workloads..."
kubectl rollout status statefulset/generator -n "${TELEMETRY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/receiver -n "${TELEMETRY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/dashboard -n "${TELEMETRY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/nginx -n "${TELEMETRY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/redis -n "${TELEMETRY_NAMESPACE}" --timeout=300s

echo
echo "Waiting for Observability workloads..."
kubectl rollout status deployment/prometheus -n "${OBSERVABILITY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/grafana -n "${OBSERVABILITY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/loki -n "${OBSERVABILITY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/tempo -n "${OBSERVABILITY_NAMESPACE}" --timeout=300s
kubectl rollout status deployment/otel-collector -n "${OBSERVABILITY_NAMESPACE}" --timeout=300s

if [[ "${INSTALL_ARGOCD}" == "true" ]]; then
  ARGO_PASSWORD="$(
    kubectl -n "${ARGOCD_NAMESPACE}" get secret argocd-initial-admin-secret \
      -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || true
  )"
fi

echo
echo "========================================"
echo "Telemetry Playground Ready"
echo "========================================"
echo
echo "Telemetry Namespace"
kubectl get pods -n "${TELEMETRY_NAMESPACE}" -o wide
echo
echo "Observability Namespace"
kubectl get pods -n "${OBSERVABILITY_NAMESPACE}" -o wide
echo
echo "Ingress"
kubectl get ingress -A
echo
echo "URLs"
echo "  Telemetry Dashboard : http://telemetry.local"
echo "  Grafana             : http://grafana.local  (admin / admin)"
echo "  Prometheus          : http://prometheus.local"
if [[ "${INSTALL_ARGOCD}" == "true" ]]; then
  echo "  Argo CD             : http://argocd.local"
  echo
  echo "Argo CD Credentials"
  echo "  Username : admin"
  echo "  Password : ${ARGO_PASSWORD:-<unavailable>}"
  echo
  echo "Argo CD Applications (auto-applied by start.sh):"
  kubectl get applications -n "${ARGOCD_NAMESPACE}" 2>/dev/null || true
fi
echo
echo "IMPORTANT — add local hostnames (Linux/macOS: /etc/hosts, Windows: hosts file):"
echo "  127.0.0.1 telemetry.local grafana.local prometheus.local argocd.local"
echo
echo "========================================"
echo "Startup Complete"
echo "========================================"
