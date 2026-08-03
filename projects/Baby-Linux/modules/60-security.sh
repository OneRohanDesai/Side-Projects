#!/usr/bin/env bash
# Module: DevSecOps — SAST/SCA/secrets/policy/k8s-security/supply-chain

module_security() {
  header "DevSecOps / Security engineering"
  ask_tier "DevSecOps (scan · secrets · policy · k8s security)"
  local tier="$REPLY_TIER"
  [[ "$tier" == "skip" ]] && {
    warn "Skipping Security module"
    return 0
  }

  install_profile_packages security

  _sec_firewall "$tier"
  _sec_secrets "$tier"
  _sec_sca_sast "$tier"

  if tier_at_least "$tier" advanced; then
    _sec_container_k8s
    _sec_policy_as_code
    _sec_secret_leak
  fi

  if tier_at_least "$tier" extreme; then
    _sec_extreme
  fi

  verify_tools "Security core" sops age gpg trivy
  if tier_at_least "$tier" advanced; then
    verify_tools "Security advanced" cosign grype syft gitleaks checkov conftest kubescape
  fi
  if tier_at_least "$tier" extreme; then
    verify_tools "Security extreme" semgrep nuclei trufflehog kube-bench falcoctl
  fi

  ok "Security module complete (tier=$tier)"
}

_sec_firewall() {
  local tier="$1"
  step "Host firewall baseline"
  if have_cmd ufw && tier_at_least "$tier" core; then
    if [[ "${ASSUME_YES:-0}" == "1" ]] || ask_yes_no "Enable UFW (deny in / allow out / allow SSH)?" "yes"; then
      run_root ufw default deny incoming
      run_root ufw default allow outgoing
      run_root ufw allow OpenSSH 2>/dev/null || run_root ufw allow 22/tcp
      run_root ufw --force enable
      enable_service ufw.service 2>/dev/null || true
      ok "UFW enabled"
    fi
  fi
  if have_cmd fail2ban-client || pm_install fail2ban 2>/dev/null; then
    if tier_at_least "$tier" advanced; then
      enable_service fail2ban.service 2>/dev/null || true
    fi
  fi
}

_sec_secrets() {
  local tier="$1"
  step "Secrets management CLIs"

  if ! have_cmd sops; then
    install_github_release "getsops/sops" "sops" \
      "sops-v[0-9.]+\\.linux\\.$(go_arch)$" || \
      install_raw_binary \
        "https://github.com/getsops/sops/releases/latest/download/sops-v3.9.4.linux.$(go_arch)" \
        "sops" || true
  fi

  if ! have_cmd age; then
    install_github_release "FiloSottile/age" "age" \
      "age-v[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true
  fi

  # vals — helm secrets backend
  if tier_at_least "$tier" advanced && need_cmd vals; then
    install_github_release "helmfile/vals" "vals" \
      "vals_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # vault CLI fallback
  if ! have_cmd vault; then
    if tier_at_least "$tier" advanced; then
      install_github_release "hashicorp/vault" "vault" \
        "vault_[0-9.]+_linux_$(go_arch)\\.zip" || true
    fi
  fi
}

_sec_sca_sast() {
  local tier="$1"
  step "SCA / vulnerability scanners"

  # Trivy
  if ! have_cmd trivy; then
    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
      | run_root sh -s -- -b "$(install_bin_target)" || true
  fi

  # grype + syft
  if tier_at_least "$tier" advanced; then
    if ! have_cmd grype; then
      curl -fsSL https://raw.githubusercontent.com/anchore/grype/main/install.sh \
        | run_root sh -s -- -b "$(install_bin_target)" || true
    fi
    if ! have_cmd syft; then
      curl -fsSL https://raw.githubusercontent.com/anchore/syft/main/install.sh \
        | run_root sh -s -- -b "$(install_bin_target)" || true
    fi
  fi

  # tfsec
  if ! have_cmd tfsec; then
    install_raw_binary \
      "https://github.com/aquasecurity/tfsec/releases/latest/download/tfsec-linux-$(go_arch)" \
      "tfsec" || true
  fi

  # checkov
  if tier_at_least "$tier" advanced; then
    pip_user_install checkov || true
  fi

  # terrascan
  if tier_at_least "$tier" advanced && need_cmd terrascan; then
    install_github_release "tenable/terrascan" "terrascan" \
      "terrascan_[0-9.]+_Linux_x86_64\\.tar\\.gz" || true
  fi

  # kics
  if tier_at_least "$tier" advanced && need_cmd kics; then
    install_github_release "Checkmarx/kics" "kics" \
      "kics_.*_linux_x64\\.tar\\.gz" || true
  fi
}

_sec_container_k8s() {
  step "Container & Kubernetes security"

  if ! have_cmd cosign; then
    install_raw_binary \
      "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-$(go_arch)" \
      "cosign" || true
  fi

  # kubescape
  if need_cmd kubescape; then
    curl -s https://raw.githubusercontent.com/kubescape/kubescape/master/install.sh | bash || true
  fi

  # kube-bench
  if need_cmd kube-bench; then
    install_github_release "aquasecurity/kube-bench" "kube-bench" \
      "kube-bench_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # kube-hunter
  if need_cmd kube-hunter; then
    pip_user_install kube-hunter || true
  fi

  # kubeaudit
  install_github_release "Shopify/kubeaudit" "kubeaudit" \
    "kubeaudit_.*_linux_$(go_arch)\\.tar\\.gz" || true

  # trivy already
  # docker-bench-security — script clone
  if [[ ! -d "$HOME/.local/share/docker-bench-security" ]]; then
    git clone --depth 1 https://github.com/docker/docker-bench-security.git \
      "$HOME/.local/share/docker-bench-security" 2>/dev/null || true
  fi

  # falcoctl (falco package manager)
  if need_cmd falcoctl; then
    install_github_release "falcosecurity/falcoctl" "falcoctl" \
      "falcoctl_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi
}

_sec_policy_as_code() {
  step "Policy as code (OPA · Conftest · Kyverno · Gatekeeper)"

  if ! have_cmd opa; then
    install_raw_binary \
      "https://openpolicyagent.org/downloads/latest/opa_linux_$(go_arch)_static" \
      "opa" || true
  fi

  if ! have_cmd conftest; then
    install_github_release "open-policy-agent/conftest" "conftest" \
      "conftest_.*_Linux_x86_64\\.tar\\.gz" || true
  fi

  # kyverno CLI
  if need_cmd kyverno; then
    install_github_release "kyverno/kyverno" "kyverno" \
      "kyverno-cli_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # gator (Gatekeeper)
  if need_cmd gator; then
    install_github_release "open-policy-agent/gatekeeper" "gator" \
      "gator-.*-linux-$(go_arch)\\.tar\\.gz" || true
  fi
}

_sec_secret_leak() {
  step "Secret leak detection"

  if ! have_cmd gitleaks; then
    install_github_release "gitleaks/gitleaks" "gitleaks" \
      "gitleaks_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  if ! have_cmd trufflehog; then
    install_github_release "trufflesecurity/trufflehog" "trufflehog" \
      "trufflehog_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # detect-secrets
  pip_user_install detect-secrets || true
}

_sec_extreme() {
  step "DevSecOps EXTREME (SAST · DAST · supply chain · host audit)"

  # semgrep
  if need_cmd semgrep; then
    pip_user_install semgrep || true
  fi

  # nuclei (projectdiscovery)
  if need_cmd nuclei; then
    install_github_release "projectdiscovery/nuclei" "nuclei" \
      "nuclei_.*_linux_$(go_arch)\\.zip" || true
  fi

  # httpx, subfinder (recon — useful for red/blue)
  install_github_release "projectdiscovery/httpx" "httpx" \
    "httpx_.*_linux_$(go_arch)\\.zip" || true
  install_github_release "projectdiscovery/subfinder" "subfinder" \
    "subfinder_.*_linux_$(go_arch)\\.zip" || true

  # bandit (python SAST)
  pip_user_install bandit safety || true

  # snyk (optional — needs account)
  if [[ "${ASSUME_YES:-0}" == "1" ]] || ask_yes_no "Install Snyk CLI (needs free account later)?" "no"; then
    npm_global snyk || \
      install_raw_binary \
        "https://github.com/snyk/cli/releases/latest/download/snyk-linux" \
        "snyk" || true
  fi

  # notation (OCI sign alternative)
  if need_cmd notation; then
    install_github_release "notaryproject/notation" "notation" \
      "notation_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # zizmor / actionlint for GH Actions security
  if need_cmd actionlint; then
    install_github_release "rhysd/actionlint" "actionlint" \
      "actionlint_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # lynis already package
  if have_cmd lynis; then
    ok "lynis ready for host audits: sudo lynis audit system"
  fi

  # osquery
  if need_cmd osqueryi; then
    case "$PM" in
      apt)
        # official osquery apt repo is heavy — skip unless wanted
        pm_install osquery 2>/dev/null || true
        ;;
      *)
        pm_install osquery 2>/dev/null || true
        ;;
    esac
  fi

  # Clair / grype already
  # kubeconform already in devops

  # Install a ready-made scan script
  deploy_file "${BABY_ROOT}/scripts/platform/sec-scan.sh" \
    "$BABY_BIN/baby-sec-scan" 755 2>/dev/null || true
  if [[ -f "${BABY_ROOT}/scripts/platform/sec-scan.sh" ]]; then
    deploy_file "${BABY_ROOT}/scripts/platform/sec-scan.sh" "$BABY_BIN/baby-sec-scan" 755
  fi
}
