#!/bin/bash
set -e

ROOT="$HOME/Gaia"
cd "$ROOT"

echo "Starting Gaia World"

mkdir -p simulations state logs
STATE_FILE="state/last_state.json"

echo "Loading previous world state..."

if [ -f "$STATE_FILE" ]; then
    echo "Previous state found. Restoring populations..."

    jq -r '.countries[] |
    "- name: \(.name)\n  continent: \(.continent)\n  population: \(.population)"' \
    "$STATE_FILE" > data/countries_runtime.yaml

else
    echo "No previous state. Using default dataset."
    cp data/countries.yaml data/countries_runtime.yaml
fi

echo "Starting dashboard backend..."

cd dashboard/backend
nohup uvicorn app:app --reload --port 9000 \
> "$ROOT/logs/dashboard.log" 2>&1 &
cd ../frontend
xdg-open index.html >/dev/null 2>&1 || true
cd "$ROOT"

echo "Creating clusters..."

for CLUSTER in global-control asia africa europe northamerica southamerica oceania
do
if ! kind get clusters | grep -q "^$CLUSTER$"; then
    kind create cluster --name $CLUSTER --config kind-config.yaml
fi
done

echo "Building simulation image..."

docker build -t gaia/country-sim:latest apps/country-simulator

echo "Loading images..."

for CLUSTER in asia africa europe northamerica southamerica oceania
do
kind load docker-image gaia/country-sim:latest --name $CLUSTER
done

echo "Generating manifests..."

source venv/bin/activate
python scripts/generate-manifests.py

echo "Deploying country pods..."

for CLUSTER in asia africa europe northamerica southamerica oceania
do
kubectl --context kind-$CLUSTER apply -f manifests/countries/$CLUSTER
done

echo "Waiting for pods..."

sleep 25

for CLUSTER in asia africa europe northamerica southamerica oceania
do
kubectl --context kind-$CLUSTER get pods
done

echo "Starting global event collector..."

mkdir -p logs
touch logs/events.log

for CLUSTER in asia africa europe northamerica southamerica oceania
do
kubectl --context kind-$CLUSTER logs -l app=country-sim \
--max-log-requests 100 -f 2>/dev/null \
| grep "|" >> logs/events.log &
done

echo "Installing Grafana..."

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update >/dev/null

helm install monitoring prometheus-community/kube-prometheus-stack \
--kube-context kind-global-control \
--namespace monitoring --create-namespace

sleep 180

kubectl --context kind-global-control exec -it deployment/monitoring-grafana \
-n monitoring -- grafana-cli admin reset-admin-password gaia123

kubectl --context kind-global-control port-forward svc/monitoring-grafana \
-n monitoring 3000:80 > logs/grafana.log 2>&1 &

echo "Installing Prometheus..."

for CLUSTER in asia africa europe northamerica southamerica oceania
do
helm install monitoring prometheus-community/kube-prometheus-stack \
--kube-context kind-$CLUSTER \
--namespace monitoring --create-namespace \
--set grafana.enabled=false \
--set prometheus-node-exporter.enabled=false
done

sleep 40

for CLUSTER in asia africa europe northamerica southamerica oceania
do
kubectl --context kind-$CLUSTER apply \
-f observability/prometheus/country-servicemonitor.yaml \
--namespace monitoring
done

kubectl --context kind-asia port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9091:9090 > logs/prom-asia.log 2>&1 &
kubectl --context kind-africa port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9092:9090 > logs/prom-africa.log 2>&1 &
kubectl --context kind-europe port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9093:9090 > logs/prom-europe.log 2>&1 &
kubectl --context kind-northamerica port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9094:9090 > logs/prom-na.log 2>&1 &
kubectl --context kind-southamerica port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9095:9090 > logs/prom-sa.log 2>&1 &
kubectl --context kind-oceania port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9096:9090 > logs/prom-oceania.log 2>&1 &

echo "Gaia simulation is active"
echo "Dashboard: http://localhost:9000"
echo "Grafana:   http://localhost:3000"
echo "Prometheus:"
echo "Asia           http://localhost:9091"
echo "Africa         http://localhost:9092"
echo "Europe         http://localhost:9093"
echo "North America  http://localhost:9094"
echo "South America  http://localhost:9095"
echo "Oceania        http://localhost:9096"