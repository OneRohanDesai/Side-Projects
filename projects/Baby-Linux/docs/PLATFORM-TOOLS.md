# Platform tools catalog (DevOps · SRE · Cloud · DevSecOps)

Baby Linux installs tools in **tiers**. During interactive install you pick:

| Tier | Intent |
|------|--------|
| **core** | Daily essentials |
| **advanced** | Production engineer workstation |
| **extreme** | Full platform / security arsenal |

Non-interactive defaults to **advanced** unless `BABY_DEFAULT_TIER=extreme` (see `profiles/extreme.conf`).

```bash
./install.sh --profile extreme -y
./install.sh --profile platform -y
./install.sh --modules devops,sre,cloud,security
BABY_DEFAULT_TIER=extreme ./install.sh --modules devops,sre,cloud,security -y
```

---

## DevOps (`modules/40-devops.sh`)

### Core
Docker / Compose / Buildx · kubectl · kubectx/kubens · helm · k9s · stern · kind · terraform/ansible · jq/yq · git/gh

### Advanced
k3d · minikube · krew + plugins · kubeconform · kube-score · kube-linter · helmfile · helm-diff/secrets · Argo CD / Argo Workflows / Flux · act · Task · dive · hadolint · lazydocker · cosign · syft · oras · crane · OpenTofu · tflint · terraform-docs · terragrunt · pre-commit

### Extreme
vcluster · clusterctl · carvel (ytt/kapp/kbld/imgkg) · skaffold · tilt · popeye · kubeseal · cmctl · pulumi · crossplane · packer · vagrant · cdktf · atmos · terraformer · tenv · earthly · dagger · nerdctl · ctop

---

## SRE (`modules/41-sre.sh`)

### Core
mtr · iperf3 · nmap · tcpdump · sysstat · bind-tools · prometheus/grafana packages when available

### Advanced
k6 · vegeta · hey · fortio · grpcurl · xh/httpie · doggo · amtool · logcli · mimirtool · profilecli · kube-capacity · pluto · nova · rbac-lookup

### Extreme
Chaos Mesh / litmusctl / pumba · chaostoolkit · otelcol-contrib · sloth · velero · s5cmd · minio `mc`

---

## Cloud (`modules/50-cloud.sh`)

### AWS
CLI v2 · Session Manager plugin · eksctl · aws-iam-authenticator · aws-vault · granted · copilot · SAM · cfn-lint · CDK · chamber · rain · localstack (extreme)

### GCP
gcloud SDK · gke-gcloud-auth-plugin · bq/gsutil · cloud-sql-proxy · kpt (extreme)

### Azure
az CLI · kubelogin · bicep · az extensions (aks-preview, azure-devops) · azcopy · Azure Functions core tools (extreme)

### Multi-cloud
infracost · steampipe · cloudquery · sops · scoutsuite · prowler · conftest · driftctl

---

## DevSecOps (`modules/60-security.sh`)

### Core
UFW baseline · sops · age · gnupg · trivy · tfsec

### Advanced
fail2ban · grype/syft · checkov · terrascan · kics · cosign · kubescape · kube-bench · kube-hunter · kubeaudit · OPA · conftest · kyverno · gator · gitleaks · trufflehog · detect-secrets · vals · vault CLI

### Extreme
semgrep · nuclei · httpx · subfinder · bandit/safety · snyk (optional) · notation · actionlint · lynis · falcoctl · `baby-sec-scan` helper

---

## Helper scripts

| Script | Purpose |
|--------|---------|
| `baby-sec-scan [path]` | Aggregate local security reports |
| `scripts/platform/k8s-bootstrap-kind.sh` | Multi-node kind cluster |
| `scripts/platform/tf-init-backend.sh` | Print remote-state backend snippets |

---

## Verify after install

```bash
# Spot-check
for c in docker kubectl helm k9s terraform tofu ansible \
         aws gcloud az trivy cosign k6 flux argocd; do
  command -v $c >/dev/null && echo "OK  $c" || echo "MISS $c"
done
```

Install log: `~/.local/state/baby-linux/install.log`

---

## Notes

- GitHub release asset names change; installers best-effort match and log failures without aborting the whole run.
- AUR packages (Arch) used when official repos lack a tool (`packages/arch/aur-platform.txt`).
- Heavy services (full Prometheus/Grafana stacks, Falco daemon, ELK) are **not** auto-deployed as long-running clusters — CLIs and packages only. Deploy stacks via Helm/Terraform as you prefer.
- Secrets and cloud credentials are never written by this repo.
