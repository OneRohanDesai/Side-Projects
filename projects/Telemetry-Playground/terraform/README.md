# Terraform — Telemetry Playground

Optional cloud infrastructure. The **app and observability stack** still deploy via Helm / Argo CD the same way as Kind.

```text
terraform/
├── aws-eks/     Amazon EKS
├── hetzner/     Single Hetzner Cloud VM
└── README.md
```

| Provider | What you get | Next step |
|----------|--------------|-----------|
| Hetzner | Ubuntu VM + firewall | Ansible → k3s → Helm / Argo CD |
| AWS | VPC + EKS node group | `kubectl` context → Helm / Argo CD |

## Flow

```text
Terraform (infra) ──► Ansible (Hetzner only) ──► Argo CD / Helm (apps)
```

## Usage sketch

```bash
cd terraform/hetzner   # or aws-eks
# set variables / secrets carefully — never commit real keys
terraform init
terraform plan
terraform apply
```

Then deploy the playground charts from the repo root (`deploy/helm/`, `argocd/`).

Local development and the canonical “clone and play” path remain **Kind + `scripts/start.sh`** — see the root [README.md](../README.md).
