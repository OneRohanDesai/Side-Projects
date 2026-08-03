# Ansible — Telemetry Playground

Optional bootstrap for a **Linux VM** (for example after Terraform creates a Hetzner server).  
For local Kind, use `scripts/start.sh` instead — no Ansible required.

## Inventory

Configure hosts under `inventory/` (see `dev.yml`, `prod.yml`, `hosts.yml`).

## Full bootstrap

From the `ansible/` directory (or adjust paths):

```bash
ansible-playbook -i inventory/dev.yml playbooks/site.yml
```

## Stages

```bash
ansible-playbook playbooks/bootstrap.yml
ansible-playbook playbooks/docker.yml
ansible-playbook playbooks/k3s.yml
ansible-playbook playbooks/helm.yml
ansible-playbook playbooks/argocd.yml
ansible-playbook playbooks/monitoring.yml
ansible-playbook playbooks/telemetry.yml
```

After Kubernetes is up, the same Helm charts under `deploy/helm/` and Argo CD apps under `argocd/` apply as on Kind.

See the root [README.md](../README.md) for architecture and play instructions.
