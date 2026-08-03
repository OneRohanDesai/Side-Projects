#!/usr/bin/env bash
# Module: DevOps — containers, Kubernetes, IaC, GitOps, CI local runners
# Tiers: core | advanced | extreme

module_devops() {
  header "DevOps platform toolchain"
  ask_tier "DevOps (containers · k8s · IaC · GitOps)"
  local tier="$REPLY_TIER"
  [[ "$tier" == "skip" ]] && {
    warn "Skipping DevOps module"
    return 0
  }

  install_profile_packages devops

  # ── CORE ──────────────────────────────────────────────────────────────────
  _devops_containers "$tier"
  _devops_kubernetes_core "$tier"
  _devops_iac_core "$tier"

  if tier_at_least "$tier" advanced; then
    _devops_kubernetes_advanced
    _devops_iac_advanced
    _devops_gitops
    _devops_ci_local
    _devops_image_supply_chain
  fi

  if tier_at_least "$tier" extreme; then
    _devops_kubernetes_extreme
    _devops_iac_extreme
    _devops_platform_extreme
  fi

  # Docker group always if docker present
  if have_cmd docker || pacman -Q docker &>/dev/null 2>&1; then
    enable_service docker.service 2>/dev/null || enable_service docker 2>/dev/null || true
    ensure_groups docker
  fi

  # Deploy shell aliases snippet
  deploy_file "${BABY_ROOT}/configs/shell/platform-aliases.zsh" \
    "$HOME/.config/baby-linux/platform-aliases.zsh" 2>/dev/null || \
    deploy_file "${BABY_ROOT}/configs/shell/platform-aliases.zsh" \
      "${BABY_CONFIG}/baby-linux/platform-aliases.zsh"
  _ensure_platform_aliases_sourced

  verify_tools "DevOps core" docker kubectl helm terraform ansible jq yq git
  if tier_at_least "$tier" advanced; then
    verify_tools "DevOps advanced" k9s kustomize stern kind k3d argocd flux cosign dive hadolint
  fi
  if tier_at_least "$tier" extreme; then
    verify_tools "DevOps extreme" pulumi tofu helmfile skaffold packer vagrant act crossplane
  fi

  ok "DevOps module complete (tier=$tier)"
}

_ensure_platform_aliases_sourced() {
  local marker="# >>> baby-linux platform aliases >>>"
  local line='[[ -f ~/.config/baby-linux/platform-aliases.zsh ]] && source ~/.config/baby-linux/platform-aliases.zsh'
  if [[ -f "$HOME/.zshrc" ]] && ! grep -q "baby-linux platform aliases" "$HOME/.zshrc" 2>/dev/null; then
    {
      echo ""
      echo "$marker"
      echo "$line"
      echo "# <<< baby-linux platform aliases <<<"
    } >>"$HOME/.zshrc"
    ok "Hooked platform aliases into ~/.zshrc"
  fi
}

# ── Containers ──────────────────────────────────────────────────────────────
_devops_containers() {
  local tier="$1"
  step "Containers runtime & tooling"

  # buildx usually with docker package; ensure plugin path
  if have_cmd docker; then
    docker buildx version &>/dev/null || warn "docker buildx not available — install docker-buildx"
  fi

  # dive — image layer explorer
  if tier_at_least "$tier" advanced; then
    install_github_release "wagoodman/dive" "dive" \
      "dive_[0-9.]+_linux_amd64\\.tar\\.gz" || true
  fi

  # hadolint — Dockerfile linter
  if tier_at_least "$tier" advanced; then
    local arch
    arch="$(go_arch)"
    install_github_release "hadolint/hadolint" "hadolint" \
      "hadolint-Linux-x86_64$" || \
      install_raw_binary \
        "https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64" \
        "hadolint" || true
  fi

  # lazydocker
  if tier_at_least "$tier" advanced; then
    install_github_release "jesseduffield/lazydocker" "lazydocker" \
      "lazydocker_[0-9.]+_Linux_x86_64\\.tar\\.gz" || true
  fi

  # ctop
  if tier_at_least "$tier" extreme; then
    install_github_release "bcicen/ctop" "ctop" \
      "ctop-[0-9.]+-linux-amd64$" || true
  fi
}

# ── Kubernetes ──────────────────────────────────────────────────────────────
_devops_kubernetes_core() {
  local tier="$1"
  step "Kubernetes core CLIs"

  # k9s if missing
  if ! have_cmd k9s; then
    install_github_release "derailed/k9s" "k9s" \
      "k9s_Linux_amd64\\.tar\\.gz" || true
  fi

  # stern
  if ! have_cmd stern; then
    install_github_release "stern/stern" "stern" \
      "stern_[0-9.]+_linux_amd64\\.tar\\.gz" || true
  fi

  # kubectx / kubens (if not packaged together)
  if ! have_cmd kubectx; then
    install_github_release "ahmetb/kubectx" "kubectx" \
      "kubectx_[0-9.]+_linux_x86_64\\.tar\\.gz" || true
  fi
  if ! have_cmd kubens; then
    # same release ships kubens
    local tmp
    tmp="$(mktemp -d)"
    (
      cd "$tmp" || exit 0
      local url
      url="$(curl -fsSL https://api.github.com/repos/ahmetb/kubectx/releases/latest \
        | grep -oE 'https://[^"]+kubens_[^"]+_linux_x86_64\.tar\.gz' | head -1)"
      [[ -n "$url" ]] && install_from_tarball "$url" "kubens"
    ) || true
    rm -rf "$tmp"
  fi

  # kind
  if ! have_cmd kind; then
    install_raw_binary \
      "https://kind.sigs.k8s.io/dl/v0.27.0/kind-linux-$(go_arch)" \
      "kind" || true
  fi
}

_devops_kubernetes_advanced() {
  step "Kubernetes advanced (local clusters · plugins · lint)"

  # k3d
  if need_cmd k3d; then
    curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash || warn "k3d install failed"
  fi

  # minikube binary fallback
  if ! have_cmd minikube; then
    install_raw_binary \
      "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-$(go_arch)" \
      "minikube" || true
  fi

  # krew
  if ! have_cmd kubectl-krew && ! [[ -d "$HOME/.krew" ]]; then
    step "Installing krew (kubectl plugin manager)"
    (
      set -e
      cd "$(mktemp -d)"
      OS="$(uname | tr '[:upper:]' '[:lower:]')"
      ARCH="$(go_arch)"
      KREW="krew-${OS}_${ARCH}"
      curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/${KREW}.tar.gz"
      tar zxvf "${KREW}.tar.gz"
      ./"${KREW}" install krew
    ) && ok "krew installed" || warn "krew install failed"
    export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"
  fi

  # Useful krew plugins
  if [[ -x "$HOME/.krew/bin/kubectl-krew" ]] || have_cmd kubectl-krew; then
    export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"
    kubectl krew install ctx ns tree neat view-secret recommend 2>/dev/null || true
  fi

  # kubeconform (schema validation)
  install_github_release "yannh/kubeconform" "kubeconform" \
    "kubeconform-linux-$(go_arch)\\.tar\\.gz" || true

  # kube-score
  install_github_release "zegl/kube-score" "kube-score" \
    "kube-score_[0-9.]+_linux_amd64\\.tar\\.gz" || true

  # kube-linter
  install_github_release "stackrox/kube-linter" "kube-linter" \
    "kube-linter-linux\\.tar\\.gz" || true

  # helmfile
  install_github_release "helmfile/helmfile" "helmfile" \
    "helmfile_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true

  # helm plugins
  if have_cmd helm; then
    helm plugin install https://github.com/databus23/helm-diff 2>/dev/null || true
    helm plugin install https://github.com/jkroepke/helm-secrets 2>/dev/null || true
    helm plugin install https://github.com/aslafy-z/helm-git 2>/dev/null || true
  fi
}

_devops_kubernetes_extreme() {
  step "Kubernetes EXTREME (GitOps-adjacent · carvel · vcluster · clusterctl)"

  # vcluster
  install_github_release "loft-sh/vcluster" "vcluster" \
    "vcluster-linux-$(go_arch)$" || true

  # clusterctl (Cluster API)
  install_raw_binary \
    "https://github.com/kubernetes-sigs/cluster-api/releases/latest/download/clusterctl-linux-$(go_arch)" \
    "clusterctl" || true

  # carvel tools: ytt, kapp, kbld, imgpkg
  for tool in ytt kapp kbld imgpkg; do
    install_raw_binary \
      "https://github.com/carvel-dev/${tool}/releases/latest/download/${tool}-linux-$(go_arch)" \
      "$tool" 2>/dev/null || \
      install_github_release "carvel-dev/${tool}" "$tool" \
        "${tool}-linux-$(go_arch)" || true
  done

  # kustomize binary fallback (newer than distro)
  if need_cmd kustomize; then
    curl -fsSL https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh \
      | bash -s -- "$(install_bin_target)" || true
  fi

  # skaffold
  install_raw_binary \
    "https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-$(go_arch)" \
    "skaffold" || true

  # tilt
  if need_cmd tilt; then
    curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash || true
  fi

  # popeye (cluster sanitizer)
  install_github_release "derailed/popeye" "popeye" \
    "popeye_Linux_$(go_arch)\\.tar\\.gz" || true

  # kubeseal (sealed-secrets)
  install_github_release "bitnami-labs/sealed-secrets" "kubeseal" \
    "kubeseal-[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true

  # external-secrets cli if exists — skip
  # cmctl (cert-manager)
  install_github_release "cert-manager/cert-manager" "cmctl" \
    "cmctl.*linux.*$(go_arch)" || \
    install_raw_binary \
      "https://github.com/cert-manager/cmctl/releases/latest/download/cmctl_linux_$(go_arch)" \
      "cmctl" || true
}

# ── IaC ─────────────────────────────────────────────────────────────────────
_devops_iac_core() {
  local tier="$1"
  step "Infrastructure as Code (core)"

  # OpenTofu if terraform missing or always on advanced+
  if ! have_cmd terraform; then
    _install_opentofu
  fi
}

_devops_iac_advanced() {
  step "IaC advanced (tofu · tflint · docs · pre-commit)"

  _install_opentofu

  if ! have_cmd tflint; then
    install_github_release "terraform-linters/tflint" "tflint" \
      "tflint_linux_$(go_arch)\\.zip" || true
  fi

  if ! have_cmd terraform-docs; then
    install_github_release "terraform-docs/terraform-docs" "terraform-docs" \
      "terraform-docs-v[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true
  fi

  if ! have_cmd terragrunt; then
    install_raw_binary \
      "https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_linux_$(go_arch)" \
      "terragrunt" || true
  fi

  # pre-commit
  if ! have_cmd pre-commit; then
    pip_user_install pre-commit || true
  fi

  # tfenv / tofuenv style version managers (extreme prefers tenv)
  :
}

_devops_iac_extreme() {
  step "IaC EXTREME (pulumi · packer · crossplane · tenv · atmos)"

  # tenv — Terraform/OpenTofu/Terragrunt version manager
  install_github_release "tofuutils/tenv" "tenv" \
    "tenv_v[0-9.]+_Linux_$(echo "$(go_arch)" | sed 's/amd64/X64/;s/arm64/arm64/')\\.tar\\.gz" || \
    install_github_release "tofuutils/tenv" "tenv" \
      "tenv_.*Linux.*\\.tar\\.gz" || true

  # pulumi
  if need_cmd pulumi; then
    curl -fsSL https://get.pulumi.com | sh || warn "pulumi install failed"
    export PATH="$HOME/.pulumi/bin:$PATH"
  fi

  # crossplane CLI
  if need_cmd crossplane; then
    install_raw_binary \
      "https://releases.crossplane.io/stable/current/bin/linux_$(go_arch)/crank" \
      "crossplane" || true
  fi

  # packer fallback
  if ! have_cmd packer; then
    install_github_release "hashicorp/packer" "packer" \
      "packer_[0-9.]+_linux_$(go_arch)\\.zip" || true
  fi

  # vagrant — heavy; only extreme
  if ! have_cmd vagrant; then
    pm_install vagrant 2>/dev/null || warn "vagrant not in repos — skip"
  fi

  # cdktf (npm)
  npm_global cdktf-cli 2>/dev/null || true

  # atmos (cloudposse)
  install_github_release "cloudposse/atmos" "atmos" \
    "atmos_[0-9.]+_linux_$(go_arch)" || true

  # terraformer
  install_github_release "GoogleCloudPlatform/terraformer" "terraformer" \
    "terraformer-all-linux-$(go_arch)$" || true
}

_install_opentofu() {
  if have_cmd tofu; then
    ok "OpenTofu present"
    return 0
  fi
  step "Installing OpenTofu"
  install_github_release "opentofu/opentofu" "tofu" \
    "tofu_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || \
    install_github_release "opentofu/opentofu" "tofu" \
      "tofu_.*_linux_$(go_arch)\\.zip" || warn "OpenTofu install failed"
}

# ── GitOps ──────────────────────────────────────────────────────────────────
_devops_gitops() {
  step "GitOps CLIs (Argo CD · Flux)"

  if ! have_cmd argocd; then
    install_raw_binary \
      "https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-$(go_arch)" \
      "argocd" || true
  fi

  # argo workflows
  if ! have_cmd argo; then
    install_raw_binary \
      "https://github.com/argoproj/argo-workflows/releases/latest/download/argo-linux-$(go_arch).gz" \
      "argo" 2>/dev/null || true
    # gz single binary sometimes
    if ! have_cmd argo; then
      local tmp
      tmp="$(mktemp)"
      if curl -fsSL -o "$tmp.gz" \
        "https://github.com/argoproj/argo-workflows/releases/latest/download/argo-linux-$(go_arch).gz"; then
        gunzip -f "$tmp.gz" 2>/dev/null || true
        [[ -f "$tmp" ]] && install_binary "$tmp" "argo"
      fi
      rm -f "$tmp" "$tmp.gz"
    fi
  fi

  # argo rollouts
  if ! have_cmd kubectl-argo-rollouts; then
    install_raw_binary \
      "https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-$(go_arch)" \
      "kubectl-argo-rollouts" || true
  fi

  # flux
  if need_cmd flux; then
    curl -fsSL https://fluxcd.io/install.sh | run_root bash || \
      curl -fsSL https://fluxcd.io/install.sh | bash || warn "flux install failed"
  fi
}

# ── CI local ────────────────────────────────────────────────────────────────
_devops_ci_local() {
  step "Local CI (act · gitlab-runner already via pkg)"

  # act — run GitHub Actions locally
  if need_cmd act; then
    install_github_release "nektos/act" "act" \
      "act_Linux_x86_64\\.tar\\.gz" || true
  fi

  # task (Taskfile)
  if ! have_cmd task; then
    install_github_release "go-task/task" "task" \
      "task_linux_$(go_arch)\\.tar\\.gz" || true
  fi
}

# ── Image supply chain (shared with security) ───────────────────────────────
_devops_image_supply_chain() {
  step "OCI / image supply chain (cosign · syft · oras · crane)"

  if ! have_cmd cosign; then
    install_raw_binary \
      "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-$(go_arch)" \
      "cosign" || true
  fi

  if ! have_cmd syft; then
    curl -fsSL https://raw.githubusercontent.com/anchore/syft/main/install.sh \
      | run_root sh -s -- -b "$(install_bin_target)" || true
  fi

  if ! have_cmd oras; then
    install_github_release "oras-project/oras" "oras" \
      "oras_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  if ! have_cmd crane; then
    install_github_release "google/go-containerregistry" "crane" \
      "go-containerregistry_Linux_x86_64\\.tar\\.gz" || true
  fi
}

_devops_platform_extreme() {
  step "Platform EXTREME extras (earthly · dagger · devbox)"

  # earthly
  if need_cmd earthly; then
    install_raw_binary \
      "https://github.com/earthly/earthly/releases/latest/download/earthly-linux-$(go_arch)" \
      "earthly" || true
  fi

  # dagger
  if need_cmd dagger; then
    curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR="$(install_bin_target)" sh || true
  fi

  # nerdctl (containerd CLI)
  install_github_release "containerd/nerdctl" "nerdctl" \
    "nerdctl-[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true
}
