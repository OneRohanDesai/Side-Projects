# Telemetry Playground

A **finished base platform** for learning and experimenting with **DevOps, SRE, Observability, GitOps, and DevSecOps**.

The application is intentionally simple. It generates synthetic traffic, failures, metrics, logs, and traces so you can break things, scale things, observe things, and extend the stack however you like.

This repository is a **stable starting point**. Fork it, clone it, run it on a laptop or in the cloud, add chaos, service mesh, policy engines, cost tools — anything. The core here stays a clean baseline you can always return to.

---

## What you get

```
Dashboard ──► Redis (generator config)
     │
Generator Pods (StatefulSet)
     │
   Nginx
     │
Receiver Pods
     │
     ├── metrics ──► Prometheus
     ├── logs    ──► Promtail ──► Loki
     └── traces  ──► OTEL Collector ──► Tempo
                              │
                           Grafana

Git ──► Argo CD ──► Kubernetes (optional GitOps path)
```

| Area | Stack |
|------|--------|
| App | Python, FastAPI, Redis, Nginx |
| Runtime | Docker, Kubernetes (Kind / k3s / EKS), Helm |
| Observability | Prometheus, Grafana, Loki, Tempo, OpenTelemetry, Promtail |
| GitOps / CI | Argo CD, GitHub Actions (lint, test, Trivy, CodeQL) |
| IaC (optional) | Terraform (Hetzner / AWS EKS), Ansible (k3s bootstrap) |

Traffic modes: `stable`, `random`, `burst`, `silent`, plus malformed packets and injected latency.

---

## Prerequisites

- Docker
- [kind](https://kind.sigs.k8s.io/), `kubectl`, Helm 3  
  (or any Kubernetes cluster if you adapt install steps)

---

## Hosts file (required for local Kind)

Ingress uses friendly hostnames. **Add these before or after starting the stack** on whatever machine runs Kind (or your local ingress):

**Linux / macOS** — edit `/etc/hosts` (needs sudo):

```text
127.0.0.1 telemetry.local grafana.local prometheus.local argocd.local
```

**Windows** — edit `C:\Windows\System32\drivers\etc\hosts` as Administrator with the same line.

Without this, the containers still run, but browser access via `*.local` will not resolve.

---

## Quick start (Kind)

```bash
git clone https://github.com/OneRohanDesai/Telemetry-Playground.git
cd Telemetry-Playground
chmod +x scripts/*.sh
./scripts/start.sh
```

`start.sh` will:

1. Create a Kind cluster (`telemetry-playground`)
2. Install ingress-nginx
3. Install Argo CD and expose it at **http://argocd.local**
4. Build app images, load them into Kind
5. Helm-install observability + the app
6. Register Argo CD Applications

Tear down:

```bash
./scripts/stop.sh
```

### URLs

| Surface | URL | Notes |
|---------|-----|--------|
| Dashboard | http://telemetry.local | Control generators |
| Grafana | http://grafana.local | `admin` / `admin` |
| Prometheus | http://prometheus.local | Targets for generators & receivers |
| Argo CD | http://argocd.local | `admin` + password printed by `start.sh` |

Argo CD password (any time):

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo
```

---

## Play freely

This playground is meant to be **yours**:

- Scale generators/receivers, inject burst/malformed traffic, watch Grafana
- Break pods, mess with configs, let Argo CD self-heal from Git
- Point Terraform/Ansible at real cloud and keep the same Helm charts
- Add Istio, Kyverno, Falco, k6, Litmus, Vault, Kafka — anything

The app layer is small on purpose. The platform around it is the product.

### Scale generators / receivers

Edit `deploy/helm/telemetry-playground/values-local.yaml`:

```yaml
replicas:
  generator: 5
  receiver: 4
```

Then either:

```bash
helm upgrade telemetry-playground deploy/helm/telemetry-playground \
  -n telemetry \
  -f deploy/helm/telemetry-playground/values.yaml \
  -f deploy/helm/telemetry-playground/values-local.yaml \
  --set imageTag=local
```

or commit + push and let **Argo CD** sync (see [docs/GITOPS-AND-SCALING.md](docs/GITOPS-AND-SCALING.md)).

### Dashboard API

```http
GET  /generators
GET  /generator/{name}
POST /generator/{name}
{
  "mode": "burst",
  "rate": 100,
  "malformed": false,
  "latency_ms": 0
}
```

### Verify observability signals

| Signal | How to check |
|--------|----------------|
| Metrics | http://prometheus.local/targets — generators/receivers **UP** |
| Metrics UI | Grafana → Telemetry Overview / Generators / Receivers |
| Logs | Grafana Explore → Loki → `{namespace="telemetry"}` |
| Traces | Grafana Explore → Tempo → service `generator` / `receiver` |
| GitOps | http://argocd.local → apps `telemetry-playground`, `observability` |

---

## Local development (optional)

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
ruff check .
pytest -q
```

```bash
docker build -t telemetry-generator:local -f docker/generator/Dockerfile .
helm template tp deploy/helm/telemetry-playground \
  -f deploy/helm/telemetry-playground/values.yaml \
  -f deploy/helm/telemetry-playground/values-local.yaml
```

---

## Repository layout

```text
app/                 Python services (generator, receiver, dashboard, common)
docker/              Dockerfiles + nginx config
deploy/helm/         App + observability Helm charts
argocd/              Argo CD Applications + Ingress
ansible/             Optional server bootstrap (k3s, docker, helm, …)
terraform/           Optional AWS EKS + Hetzner scaffolding
scripts/             Kind start / stop
docs/                GitOps, scaling, deeper notes
.github/workflows/   CI, release, CodeQL
tests/               Unit / API tests
```

---

## CI / CD

| Workflow | When | What |
|----------|------|------|
| **CI** | push / PR | ruff, pytest, helm lint, image build, Trivy, SBOM |
| **Release** | push to `main` | push images to GHCR, bump Helm `imageTag` |
| **CodeQL** | main + schedule | static analysis |

### Argo CD target branch

Argo CD Applications track **`main`**. Keep `targetRevision` on the branch that contains the current Helm charts. If Argo tracks an old revision that still used a `Deployment` for generators while the live cluster uses a `StatefulSet`, you get duplicate pods and inflated Prometheus target counts.

---

## Cloud / advanced

- **Terraform:** [terraform/README.md](terraform/README.md) — Hetzner VM or AWS EKS  
- **Ansible:** [ansible/README.md](ansible/README.md) — bootstrap docker, k3s, helm, Argo CD  
- **GitOps detail:** [docs/GITOPS-AND-SCALING.md](docs/GITOPS-AND-SCALING.md)  
- **Dashboard ideas:** [Grafana_Charts.md](Grafana_Charts.md)

Kind local path defaults to **direct Helm** (`USE_HELM_DIRECT=true`) so images with `imagePullPolicy: Never` always work. Argo CD is still installed and Applications are registered for the GitOps loop.

```bash
USE_HELM_DIRECT=false ./scripts/start.sh   # pure GitOps install path
```

---

## Philosophy

> Keep the application simple. Make the platform interesting.

**Status: complete baseline.**  
Use it, fork it, extend it — the core stays a finished Telemetry Playground you can always come back to.

---

NOTE : Code comments and markdown files curated using Grok CLI - that's why '—' are present 😅. And some of the nice formatting at end of project completion is also done by Grok CLI. Majority of the code is human code, you can know that by seeing commit history.
