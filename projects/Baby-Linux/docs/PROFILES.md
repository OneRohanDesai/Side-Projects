# Profiles & modules

## Profiles

| Profile | Modules | Default tool tier | Use when |
|---------|---------|-------------------|----------|
| `minimal` | base, shell | — | Server shell only |
| `devops` | + devops, sre, cloud, security | prompted / advanced w/ `-y` | Headless engineer |
| `platform` | headless platform pack | **advanced** | No desktop, strong CLIs |
| `full` | desktop + full platform | prompted / advanced w/ `-y` | Daily driver laptop |
| `laptop` | same as full + laptop | prompted | Explicit laptop |
| `extreme` | all modules | **extreme** | Maximum arsenal |

```bash
./install.sh --profile extreme -y
./install.sh --profile platform -y
BABY_DEFAULT_TIER=extreme ./install.sh --modules devops,sre,cloud,security -y
```

See **[PLATFORM-TOOLS.md](PLATFORM-TOOLS.md)** for the full tool list per tier.

## Modules (detail)

### base / shell / desktop / devtools / virt / laptop
Unchanged from desktop bootstrap (CLI, i3, languages, QEMU, TLP).

### devops (tiered)
Containers, Kubernetes, IaC, GitOps, local CI, OCI supply chain.  
Extreme adds pulumi, crossplane, carvel, vcluster, earthly, dagger, …

### sre (tiered)
Diagnostics, load testing (k6/vegeta), log/metric CLIs, chaos, velero, otelcol, SLO tools.

### cloud (tiered)
AWS (CLI, SSM, eksctl, aws-vault, SAM, CDK) · GCP (gcloud, GKE auth, sql-proxy) · Azure (az, kubelogin, bicep) · multi-cloud (infracost, steampipe, prowler).

### security (tiered)
UFW, sops/age, trivy/grype/checkov, cosign, kubescape, OPA/Kyverno, gitleaks, semgrep, nuclei, `baby-sec-scan`.

## Custom selection

```bash
./install.sh --modules base,shell,devops,sre,cloud,security
```

Or pick **Custom** in the interactive menu. Each of devops/sre/cloud/security will ask for install depth unless `-y` is set.
