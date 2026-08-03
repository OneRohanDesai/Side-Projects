# Baby Linux — platform-engineer aliases & helpers
# Sourced from ~/.zshrc after install

# ── Kubernetes ──────────────────────────────────────────────────────────────
alias k='kubectl'
alias kx='kubectx'
alias kns='kubens'
alias kgp='kubectl get pods -A'
alias kgpa='kubectl get pods -A -o wide'
alias kgn='kubectl get nodes -o wide'
alias kgs='kubectl get svc -A'
alias kgd='kubectl get deploy -A'
alias kdp='kubectl describe pod'
alias kl='kubectl logs -f'
alias kex='kubectl exec -it'
alias kpf='kubectl port-forward'
alias krr='kubectl rollout restart'
alias k9='k9s'
alias sterna='stern --all-namespaces'

# kubectl with dry-run helper
kapply() { kubectl apply -f "$1" "${@:2}"; }
kdel()  { kubectl delete -f "$1" "${@:2}"; }
kdrain(){ kubectl drain "$1" --ignore-daemonsets --delete-emptydir-data; }

# ── Helm / GitOps ───────────────────────────────────────────────────────────
alias h='helm'
alias hls='helm list -A'
alias hf='helmfile'
alias argo='argocd'

# ── Terraform / OpenTofu ────────────────────────────────────────────────────
alias tf='terraform'
alias tfi='terraform init'
alias tfp='terraform plan'
alias tfa='terraform apply'
alias tfd='terraform destroy'
alias tff='terraform fmt -recursive'
alias tfv='terraform validate'
alias tg='terragrunt'
alias tofu='tofu'
alias tfpw='terraform plan -out=tfplan && terraform show -no-color tfplan | head'

# ── Docker / containers ─────────────────────────────────────────────────────
alias d='docker'
alias dc='docker compose'
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dclean='docker system prune -af --volumes'
alias dlogs='docker logs -f'
alias ld='lazydocker'

# ── Cloud ───────────────────────────────────────────────────────────────────
alias awswho='aws sts get-caller-identity'
alias awsr='aws configure list-profiles'
alias gwho='gcloud config list'
alias azwho='az account show -o table 2>/dev/null'

# ── Security scanners (quick) ───────────────────────────────────────────────
alias tfs='tfsec .'
alias trivyfs='trivy fs --scanners vuln,secret,misconfig .'
alias trivyimg='trivy image'
alias gitleak='gitleaks detect -v'
alias chk='checkov -d .'

# ── SRE ─────────────────────────────────────────────────────────────────────
alias k6run='k6 run'
alias mtrr='sudo mtr -rwzbc 100'

# ── Quality of life ─────────────────────────────────────────────────────────
alias tfdocs='terraform-docs markdown table .'
alias pretf='pre-commit run -a'

# krew path
[[ -d ${KREW_ROOT:-$HOME/.krew}/bin ]] && export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"
# pulumi
[[ -d $HOME/.pulumi/bin ]] && export PATH="$HOME/.pulumi/bin:$PATH"
# npm global
[[ -d $HOME/.npm-global/bin ]] && export PATH="$HOME/.npm-global/bin:$PATH"
# google cloud
[[ -d $HOME/google-cloud-sdk/bin ]] && export PATH="$HOME/google-cloud-sdk/bin:$PATH"
