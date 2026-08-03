# GitOps, Argo CD, and scaling

## Argo CD on this playground

`scripts/start.sh` (with `INSTALL_ARGOCD=true`, the default):

1. Installs Argo CD
2. Enables `server.insecure` so the UI works over **HTTP**
3. Creates Ingress **http://argocd.local**
4. Applies Applications from `argocd/*.yaml`

### Hosts

```text
127.0.0.1 telemetry.local grafana.local prometheus.local argocd.local
```

### Login

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo
```

Open **http://argocd.local** → user `admin` + that password.

### Applications

| Name | Path | Branch |
|------|------|--------|
| `telemetry-playground` | `deploy/helm/telemetry-playground` | `main` |
| `observability` | `deploy/helm/observability` | `main` |

```bash
kubectl get applications -n argocd
```

---

## Git → cluster loop

```text
git push ──► GitHub ──► Argo CD poll/sync ──► Helm charts ──► cluster
```

1. Edit Helm values/templates on `main`
2. Commit and push
3. Wait ~3 minutes or **Refresh → Sync** in Argo CD
4. Watch pods: `kubectl get pods -n telemetry -w`

### Kind + local images

`values-local.yaml` uses:

- images `telemetry-*:local`
- `imagePullPolicy: Never`

If you change **application code**, rebuild and load images (Argo CD does not build Docker images):

```bash
docker build -t telemetry-generator:local -f docker/generator/Dockerfile .
# receiver, dashboard, nginx likewise
kind load docker-image telemetry-generator:local --name telemetry-playground
kubectl rollout restart statefulset/generator -n telemetry
```

---

## Scaling generators and receivers

### Recommended — Helm values

`deploy/helm/telemetry-playground/values-local.yaml`:

```yaml
replicas:
  generator: 5
  receiver: 4
```

Apply:

```bash
helm upgrade telemetry-playground deploy/helm/telemetry-playground \
  -n telemetry \
  -f deploy/helm/telemetry-playground/values.yaml \
  -f deploy/helm/telemetry-playground/values-local.yaml \
  --set imageTag=local
```

Or commit + push and let Argo CD sync.

### Quick kubectl (temporary)

```bash
kubectl scale statefulset/generator -n telemetry --replicas=5
kubectl scale deployment/receiver -n telemetry --replicas=4
```

Argo CD / Helm may revert this on the next sync.

### Observe

| Check | Where |
|-------|--------|
| Pods | `kubectl get pods -n telemetry` |
| Dashboard dropdown | http://telemetry.local |
| Prometheus targets | http://prometheus.local/targets |
| Grafana series | Telemetry Overview / Generators / Receivers |
| Argo CD | http://argocd.local |

```promql
count(up{job="generators"} == 1)
count(up{job="receivers"} == 1)
sum by (generator) (rate(telemetry_packets_sent_total[1m]))
```

---

## Logs and traces

```logql
{namespace="telemetry"}
{namespace="telemetry", container="generator"}
```

Grafana Explore → **Tempo** → search service `generator` or `receiver`.

```bash
kubectl logs -n observability -l app=otel-collector --tail=20
kubectl logs -n observability -l app=promtail --tail=20
```
