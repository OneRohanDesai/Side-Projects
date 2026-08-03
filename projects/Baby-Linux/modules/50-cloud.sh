#!/usr/bin/env bash
# Module: Multi-cloud — AWS · GCP · Azure deep toolchains

module_cloud() {
  header "Cloud engineering (AWS · GCP · Azure)"
  ask_tier "Cloud providers & ecosystem tools"
  local tier="$REPLY_TIER"
  [[ "$tier" == "skip" ]] && {
    warn "Skipping Cloud module"
    return 0
  }

  install_profile_packages cloud 2>/dev/null || true

  # Always offer all three providers at core+
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    CLOUD_AWS=1
    CLOUD_GCP=1
    CLOUD_AZURE=1
  else
    ask_multi "Which clouds? (space-separated)" \
      "AWS (CLI + EKS/IAM/session tools)" \
      "GCP (gcloud + GKE auth)" \
      "Azure (az + AKS kubelogin)" \
      "Multi-cloud cost & IaC helpers"
    CLOUD_AWS=0 CLOUD_GCP=0 CLOUD_AZURE=0 CLOUD_MULTI=0
    for idx in $REPLY_MULTI; do
      case "$idx" in
        1) CLOUD_AWS=1 ;;
        2) CLOUD_GCP=1 ;;
        3) CLOUD_AZURE=1 ;;
        4) CLOUD_MULTI=1 ;;
      esac
    done
    # default all if empty selection
    if [[ -z "${REPLY_MULTI// /}" ]]; then
      CLOUD_AWS=1
      CLOUD_GCP=1
      CLOUD_AZURE=1
      CLOUD_MULTI=1
    fi
  fi

  [[ "${CLOUD_AWS:-0}" == "1" ]] && _cloud_aws "$tier"
  [[ "${CLOUD_GCP:-0}" == "1" ]] && _cloud_gcp "$tier"
  [[ "${CLOUD_AZURE:-0}" == "1" ]] && _cloud_azure "$tier"

  if tier_at_least "$tier" advanced || [[ "${CLOUD_MULTI:-0}" == "1" ]]; then
    _cloud_multicloud_helpers "$tier"
  fi

  if tier_at_least "$tier" extreme; then
    _cloud_extreme
  fi

  # shell completions snippet
  _cloud_shell_hooks

  verify_tools "Cloud" aws gcloud az 2>/dev/null || true
  ok "Cloud module complete (tier=$tier)"
}

# ── AWS ─────────────────────────────────────────────────────────────────────
_cloud_aws() {
  local tier="$1"
  header "AWS toolchain"

  # AWS CLI v2
  if need_cmd aws; then
    step "Installing AWS CLI v2"
    local tmp
    tmp="$(mktemp -d)"
    (
      cd "$tmp" || exit 1
      local zip="awscliv2.zip"
      case "$(uname -m)" in
        aarch64 | arm64)
          curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "$zip"
          ;;
        *)
          curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "$zip"
          ;;
      esac
      unzip -q "$zip"
      run_root ./aws/install --update 2>/dev/null || run_root ./aws/install
    ) && ok "AWS CLI installed" || warn "AWS CLI install failed"
    rm -rf "$tmp"
  else
    ok "AWS CLI: $(aws --version 2>&1 | head -1)"
  fi

  # Session Manager plugin (SSM shell)
  if tier_at_least "$tier" core; then
    _aws_session_manager_plugin
  fi

  if tier_at_least "$tier" advanced; then
    # eksctl
    if need_cmd eksctl; then
      step "Installing eksctl"
      local arch
      arch="$(go_arch)"
      curl -fsSL "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_${arch}.tar.gz" \
        | tar xz -C /tmp
      install_binary /tmp/eksctl eksctl
    fi

    # aws-iam-authenticator
    if need_cmd aws-iam-authenticator; then
      install_raw_binary \
        "https://github.com/kubernetes-sigs/aws-iam-authenticator/releases/latest/download/aws-iam-authenticator_0.6.29_linux_$(go_arch)" \
        "aws-iam-authenticator" 2>/dev/null || \
        install_github_release "kubernetes-sigs/aws-iam-authenticator" "aws-iam-authenticator" \
          "aws-iam-authenticator_.*_linux_$(go_arch)$" || true
    fi

    # aws-vault
    if need_cmd aws-vault; then
      install_github_release "99designs/aws-vault" "aws-vault" \
        "aws-vault-linux-$(go_arch)\\.tar\\.gz" || \
        install_raw_binary \
          "https://github.com/99designs/aws-vault/releases/latest/download/aws-vault-linux-$(go_arch)" \
          "aws-vault" || true
    fi

    # cfn-lint
    pip_user_install cfn-lint || true

    # aws-sso util / granted (better SSO)
    if need_cmd granted; then
      install_github_release "common-fate/granted" "granted" \
        "granted_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
    fi

    # copilot
    if need_cmd copilot; then
      install_raw_binary \
        "https://github.com/aws/copilot-cli/releases/latest/download/copilot-linux" \
        "copilot" || true
    fi

    # sam cli
    if need_cmd sam; then
      pip_user_install aws-sam-cli 2>/dev/null || \
        install_github_release "aws/aws-sam-cli" "sam" \
          "aws-sam-cli-linux-x86_64\\.zip" || true
    fi
  fi

  if tier_at_least "$tier" extreme; then
    # cdk
    npm_global aws-cdk || true

    # awscli-local / localstack
    pip_user_install localstack awscli-local 2>/dev/null || true

    # chamber (SSM params)
    install_github_release "segmentio/chamber" "chamber" \
      "chamber-v[0-9.]+-linux-$(go_arch)$" || true

    # ssm-helpers
    install_github_release "disneystreaming/ssm-helpers" "ssm" \
      "ssm-helpers_.*_Linux_x86_64\\.tar\\.gz" 2>/dev/null || true

    # rain (cfn CLI)
    install_github_release "aws-cloudformation/rain" "rain" \
      "rain-v[0-9.]+_linux-$(go_arch)\\.tar\\.gz" || true

    # ecr-login helper often via docker credential helper
    install_github_release "awslabs/amazon-ecr-credential-helper" "docker-credential-ecr-login" \
      "docker-credential-ecr-login.*linux.*" 2>/dev/null || true
  fi
}

_aws_session_manager_plugin() {
  if have_cmd session-manager-plugin; then
    ok "session-manager-plugin present"
    return 0
  fi
  step "Installing AWS Session Manager plugin"
  case "$PM" in
    pacman)
      aur_install aws-session-manager-plugin 2>/dev/null || _aws_ssm_deb_rpm_fallback
      ;;
    apt)
      local tmp
      tmp="$(mktemp -d)"
      curl -fsSL "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" \
        -o "$tmp/ssm.deb"
      run_root dpkg -i "$tmp/ssm.deb" || run_root apt-get install -f -y
      rm -rf "$tmp"
      ;;
    dnf | yum)
      run_root dnf install -y \
        "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm" \
        || true
      ;;
    *)
      _aws_ssm_deb_rpm_fallback
      ;;
  esac
}

_aws_ssm_deb_rpm_fallback() {
  local tmp
  tmp="$(mktemp -d)"
  (
    cd "$tmp" || exit 1
    curl -fsSL "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm" -o ssm.rpm 2>/dev/null || true
    if [[ -f ssm.rpm ]] && have_cmd rpm; then
      run_root rpm -i ssm.rpm || true
    else
      curl -fsSL "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o ssm.deb
      if have_cmd dpkg; then
        run_root dpkg -i ssm.deb || true
      else
        # extract and place binary from official zip bundle if available
        warn "Install session-manager-plugin manually for this distro"
      fi
    fi
  )
  rm -rf "$tmp"
}

# ── GCP ─────────────────────────────────────────────────────────────────────
_cloud_gcp() {
  local tier="$1"
  header "GCP toolchain"

  if need_cmd gcloud; then
    step "Installing Google Cloud SDK"
    case "$PM" in
      apt)
        run_root apt-get install -y apt-transport-https ca-certificates gnupg curl
        curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
          | run_root gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
        echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
          | run_root tee /etc/apt/sources.list.d/google-cloud-sdk.list >/dev/null
        run_root apt-get update -y
        run_root apt-get install -y google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin \
          || run_root apt-get install -y google-cloud-sdk || warn "gcloud apt failed"
        ;;
      dnf | yum)
        run_root tee /etc/yum.repos.d/google-cloud-sdk.repo >/dev/null <<'REPO'
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
REPO
        run_root dnf install -y google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin || true
        ;;
      pacman)
        if have_cmd yay || ensure_yay; then
          aur_install google-cloud-cli 2>/dev/null || true
        fi
        if ! have_cmd gcloud; then
          local tmp
          tmp="$(mktemp -d)"
          curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz \
            | tar -xz -C "$tmp"
          "$tmp"/google-cloud-sdk/install.sh --quiet --path-update false --command-completion false --usage-reporting false \
            || warn "gcloud tarball install failed"
          mkdir -p "$HOME/.local"
          rm -rf "$HOME/google-cloud-sdk"
          mv "$tmp/google-cloud-sdk" "$HOME/google-cloud-sdk"
          # path hook
          if ! grep -q 'google-cloud-sdk/path.zsh.inc' "$HOME/.zshrc" 2>/dev/null; then
            echo '[[ -f $HOME/google-cloud-sdk/path.zsh.inc ]] && source $HOME/google-cloud-sdk/path.zsh.inc' >>"$HOME/.zshrc"
            echo '[[ -f $HOME/google-cloud-sdk/completion.zsh.inc ]] && source $HOME/google-cloud-sdk/completion.zsh.inc' >>"$HOME/.zshrc"
          fi
          export PATH="$HOME/google-cloud-sdk/bin:$PATH"
          rm -rf "$tmp"
        fi
        ;;
      *)
        warn "Install gcloud from https://cloud.google.com/sdk/docs/install"
        ;;
    esac
  else
    ok "gcloud present"
  fi

  if tier_at_least "$tier" advanced; then
    # GKE auth plugin
    if have_cmd gcloud; then
      gcloud components install gke-gcloud-auth-plugin --quiet 2>/dev/null || true
      gcloud components install kubectl --quiet 2>/dev/null || true
      gcloud components install bq --quiet 2>/dev/null || true
      gcloud components install gsutil --quiet 2>/dev/null || true
      gcloud components install alpha beta --quiet 2>/dev/null || true
    fi

    # cloud-sql-proxy
    if need_cmd cloud-sql-proxy; then
      install_raw_binary \
        "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.linux.$(go_arch)" \
        "cloud-sql-proxy" || \
        install_github_release "GoogleCloudPlatform/cloud-sql-proxy" "cloud-sql-proxy" \
          "cloud-sql-proxy\\.linux\\.$(go_arch)$" || true
    fi
  fi

  if tier_at_least "$tier" extreme; then
    # anthos / kpt
    if need_cmd kpt; then
      install_raw_binary \
        "https://github.com/GoogleContainerTools/kpt/releases/latest/download/kpt_linux_$(go_arch)" \
        "kpt" || true
    fi
    # skaffold already in devops extreme
    # gke-policy-automation etc.
    pip_user_install google-cloud-storage google-cloud-bigquery 2>/dev/null || true
  fi
}

# ── Azure ───────────────────────────────────────────────────────────────────
_cloud_azure() {
  local tier="$1"
  header "Azure toolchain"

  if need_cmd az; then
    step "Installing Azure CLI"
    case "$PM" in
      apt)
        curl -sL https://aka.ms/InstallAzureCLIDeb | run_root bash || warn "az install failed"
        ;;
      dnf | yum)
        run_root rpm --import https://packages.microsoft.com/keys/microsoft.asc 2>/dev/null || true
        curl -sL https://aka.ms/InstallAzureCLIRpm | run_root bash || \
          run_root dnf install -y azure-cli || warn "az install failed"
        ;;
      pacman)
        aur_install azure-cli 2>/dev/null || \
          curl -sL https://aka.ms/InstallAzureCLIDeb | run_root bash 2>/dev/null || \
          warn "azure-cli: try yay -S azure-cli"
        ;;
      *)
        curl -sL https://aka.ms/InstallAzureCLIDeb | run_root bash 2>/dev/null || \
          warn "Install az from https://learn.microsoft.com/cli/azure/install-azure-cli"
        ;;
    esac
  else
    ok "az present"
  fi

  if tier_at_least "$tier" advanced; then
    # kubelogin for AKS AAD
    if need_cmd kubelogin; then
      install_github_release "Azure/kubelogin" "kubelogin" \
        "kubelogin-linux-$(go_arch)\\.zip" || true
    fi

    # bicep
    if need_cmd bicep; then
      install_raw_binary \
        "https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64" \
        "bicep" || true
    fi

    # az extensions commonly used
    if have_cmd az; then
      az extension add --name aks-preview --yes 2>/dev/null || true
      az extension add --name azure-devops --yes 2>/dev/null || true
      az extension add --name account --yes 2>/dev/null || true
    fi
  fi

  if tier_at_least "$tier" extreme; then
    # func (Azure functions core tools) via npm
    npm_global azure-functions-core-tools@4 2>/dev/null || true
    # azcopy
    if need_cmd azcopy; then
      local tmp
      tmp="$(mktemp -d)"
      curl -fsSL -o "$tmp/azcopy.tgz" \
        "https://aka.ms/downloadazcopy-v10-linux"
      tar -xzf "$tmp/azcopy.tgz" -C "$tmp"
      local bin
      bin="$(find "$tmp" -type f -name azcopy | head -1)"
      [[ -n "$bin" ]] && install_binary "$bin" "azcopy"
      rm -rf "$tmp"
    fi
  fi
}

# ── Multi-cloud ─────────────────────────────────────────────────────────────
_cloud_multicloud_helpers() {
  local tier="$1"
  step "Multi-cloud helpers (cost · drift · inventory)"

  # infracost
  if need_cmd infracost; then
    curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh || true
  fi

  # steampipe — SQL across cloud APIs
  if tier_at_least "$tier" advanced && need_cmd steampipe; then
    install_github_release "turbot/steampipe" "steampipe" \
      "steampipe_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # terraformer already in devops extreme
  # driftctl deprecated → use terraform plan; still install if wanted
  if tier_at_least "$tier" extreme && need_cmd driftctl; then
    install_github_release "snyk/driftctl" "driftctl" \
      "driftctl_linux_$(go_arch)$" || true
  fi

  # cloudquery
  if tier_at_least "$tier" extreme && need_cmd cloudquery; then
    install_github_release "cloudquery/cloudquery" "cloudquery" \
      "cloudquery_linux_$(go_arch)\\.zip" || true
  fi

  # rclone already packaged
  # sops for encrypted cloud secrets
  if ! have_cmd sops; then
    install_raw_binary \
      "https://github.com/getsops/sops/releases/latest/download/sops-v3.9.4.linux.$(go_arch)" \
      "sops" 2>/dev/null || \
      install_github_release "getsops/sops" "sops" \
        "sops-.*\\.linux\\.$(go_arch)$" || true
  fi
}

_cloud_extreme() {
  step "Cloud EXTREME (policy · inventory · connectors)"

  # opa already in security — ensure
  # confest
  if ! have_cmd conftest; then
    install_github_release "open-policy-agent/conftest" "conftest" \
      "conftest_.*_Linux_x86_64\\.tar\\.gz" || true
  fi

  # terraform-compliance
  pip_user_install terraform-compliance 2>/dev/null || true

  # scout suite (multi-cloud audit)
  pip_user_install scoutsuite 2>/dev/null || true

  # prowler (AWS security best practices)
  pip_user_install prowler 2>/dev/null || true

  # cloudmapper (AWS network viz) — heavy deps, optional
  # pip_user_install cloudmapper 2>/dev/null || true
}

_cloud_shell_hooks() {
  local f="$HOME/.config/baby-linux/cloud-completions.zsh"
  mkdir -p "$(dirname "$f")"
  cat >"$f" <<'EOF'
# Baby Linux — cloud CLI completions (safe if commands missing)
command -v aws >/dev/null && source <(aws completion zsh 2>/dev/null) || true
command -v kubectl >/dev/null && source <(kubectl completion zsh 2>/dev/null) || true
command -v helm >/dev/null && source <(helm completion zsh 2>/dev/null) || true
command -v eksctl >/dev/null && source <(eksctl completion zsh 2>/dev/null) || true
command -v gcloud >/dev/null && {
  [[ -f $HOME/google-cloud-sdk/completion.zsh.inc ]] && source $HOME/google-cloud-sdk/completion.zsh.inc
}
command -v flux >/dev/null && source <(flux completion zsh 2>/dev/null) || true
command -v argocd >/dev/null && source <(argocd completion zsh 2>/dev/null) || true
command -v terraform >/dev/null && complete -o nospace -C "$(command -v terraform)" terraform 2>/dev/null || true
command -v tofu >/dev/null && complete -o nospace -C "$(command -v tofu)" tofu 2>/dev/null || true
EOF
  if [[ -f "$HOME/.zshrc" ]] && ! grep -q "cloud-completions.zsh" "$HOME/.zshrc" 2>/dev/null; then
    echo '[[ -f ~/.config/baby-linux/cloud-completions.zsh ]] && source ~/.config/baby-linux/cloud-completions.zsh' >>"$HOME/.zshrc"
  fi
  ok "Cloud completion hooks installed"
}
