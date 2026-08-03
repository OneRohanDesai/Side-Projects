#!/usr/bin/env bash
# Module: SRE — observability, reliability, load testing, chaos, DR

module_sre() {
  header "SRE / Observability / Reliability"
  ask_tier "SRE (observability · load · chaos · DR)"
  local tier="$REPLY_TIER"
  [[ "$tier" == "skip" ]] && {
    warn "Skipping SRE module"
    return 0
  }

  install_profile_packages sre

  _sre_diagnostics "$tier"
  _sre_observability_clis "$tier"

  if tier_at_least "$tier" advanced; then
    _sre_load_testing
    _sre_log_metric_tools
    _sre_k8s_reliability
  fi

  if tier_at_least "$tier" extreme; then
    _sre_chaos
    _sre_slo_tracing
    _sre_dr_backup
  fi

  verify_tools "SRE core" mtr dig nmap curl jq
  if tier_at_least "$tier" advanced; then
    verify_tools "SRE advanced" k6 vegeta promtool logcli
  fi
  if tier_at_least "$tier" extreme; then
    verify_tools "SRE extreme" otelcol-contrib chaos litmusctl velero
  fi

  ok "SRE module complete (tier=$tier)"
}

_sre_diagnostics() {
  local tier="$1"
  step "Network & host diagnostics"
  # packages cover mtr, iperf3, nmap, tcpdump, sysstat
  # grpcurl
  if tier_at_least "$tier" advanced; then
    install_github_release "fullstorydev/grpcurl" "grpcurl" \
      "grpcurl_[0-9.]+_linux_x86_64\\.tar\\.gz" || true
  fi
  # httpie / xh
  if tier_at_least "$tier" advanced; then
    if ! have_cmd xh; then
      install_github_release "ducaale/xh" "xh" \
        "xh-v[0-9.]+-x86_64-unknown-linux-musl\\.tar\\.gz" || true
    fi
    pm_install httpie 2>/dev/null || pip_user_install httpie || true
  fi
  # dog / doggo DNS client
  if tier_at_least "$tier" advanced; then
    install_github_release "mr-karan/doggo" "doggo" \
      "doggo_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi
}

_sre_observability_clis() {
  local tier="$1"
  step "Observability CLIs"

  # promtool often with prometheus package
  if ! have_cmd promtool && tier_at_least "$tier" core; then
    info "promtool comes with prometheus package when available"
  fi

  # amtool (alertmanager)
  if tier_at_least "$tier" advanced && ! have_cmd amtool; then
    install_github_release "prometheus/alertmanager" "amtool" \
      "alertmanager-[0-9.]+\\.linux-$(go_arch)\\.tar\\.gz" || true
  fi
}

_sre_load_testing() {
  step "Load & performance testing"

  if ! have_cmd k6; then
    install_github_release "grafana/k6" "k6" \
      "k6-v[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true
  fi

  # vegeta
  if ! have_cmd vegeta; then
    install_github_release "tsenart/vegeta" "vegeta" \
      "vegeta_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # hey already may be packaged; fallback
  if ! have_cmd hey; then
    go_install "github.com/rakyll/hey@latest" "hey" || true
  fi

  # fortio
  if ! have_cmd fortio; then
    install_github_release "fortio/fortio" "fortio" \
      "fortio-linux_$(go_arch)-[0-9.]+\\.tgz" || true
  fi

  # wrk (may need compile — skip if no package)
  pm_install wrk 2>/dev/null || true
}

_sre_log_metric_tools() {
  step "Logs · metrics · traces CLIs"

  # logcli (loki)
  if ! have_cmd logcli; then
    install_github_release "grafana/loki" "logcli" \
      "logcli-linux-$(go_arch)\\.zip" || true
  fi

  # mimirtool / cortextool optional
  if ! have_cmd mimirtool; then
    install_github_release "grafana/mimir" "mimirtool" \
      "mimirtool-linux-$(go_arch)$" || true
  fi

  # pyroscope CLI
  if ! have_cmd profilecli && ! have_cmd pyroscope; then
    install_github_release "grafana/pyroscope" "profilecli" \
      "profilecli_.*_linux_$(go_arch)\\.tar\\.gz" || true
  fi
}

_sre_k8s_reliability() {
  step "Kubernetes reliability helpers"

  # stern already in devops
  # kubectl-neat via krew
  export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

  # goldilocks / vpa viewers — skip heavy
  # kube-capacity
  install_github_release "robscott/kube-capacity" "kube-capacity" \
    "kube-capacity_.*_linux_$(go_arch)\\.tar\\.gz" || true

  # kubectl-cost (OpenCost)
  install_github_release "opencost/opencost" "kubectl-cost" \
    "kubectl-cost-.*linux.*" 2>/dev/null || true

  # pluto (deprecated API detection)
  install_github_release "FairwindsOps/pluto" "pluto" \
    "pluto_.*_linux_$(go_arch)\\.tar\\.gz" || true

  # nova (helm outdated charts)
  install_github_release "FairwindsOps/nova" "nova" \
    "nova_.*_linux_$(go_arch)\\.tar\\.gz" || true

  # rbac-lookup
  install_github_release "FairwindsOps/rbac-lookup" "rbac-lookup" \
    "rbac-lookup_.*_linux_$(go_arch)\\.tar\\.gz" || true
}

_sre_chaos() {
  step "Chaos engineering CLIs"

  # chaos mesh ctl
  if ! have_cmd chaos; then
    install_github_release "chaos-mesh/chaos-mesh" "chaos" \
      "chaos-mesh.*linux.*" 2>/dev/null || true
  fi
  # chaosctl alternate name
  install_raw_binary \
    "https://mirrors.chaos-mesh.org/latest/chaosctl-linux-$(go_arch)" \
    "chaosctl" 2>/dev/null || true

  # litmusctl
  if ! have_cmd litmusctl; then
    install_github_release "litmuschaos/litmusctl" "litmusctl" \
      "litmusctl-linux-$(go_arch)-.*" || \
      install_raw_binary \
        "https://litmusctl-production-bucket.s3.amazonaws.com/litmusctl-linux-$(go_arch)" \
        "litmusctl" || true
  fi

  # pumba may be packaged
  if ! have_cmd pumba; then
    install_github_release "alexei-led/pumba" "pumba" \
      "pumba_linux_$(go_arch)$" || true
  fi

  # powerfulseal / chaostoolkit
  pip_user_install chaostoolkit 2>/dev/null || true
}

_sre_slo_tracing() {
  step "SLO · OpenTelemetry · tracing"

  # otelcol-contrib
  if ! have_cmd otelcol-contrib && ! have_cmd otelcol; then
    install_github_release "open-telemetry/opentelemetry-collector-releases" "otelcol-contrib" \
      "otelcol-contrib_[0-9.]+_linux_$(go_arch)\\.tar\\.gz" || true
  fi

  # sloth (SLO generator)
  install_github_release "slok/sloth" "sloth" \
    "sloth-linux-$(go_arch)$" || \
    install_github_release "slok/sloth" "sloth" \
      "sloth_.*linux.*" || true

  # jaeger cli — optional
  if ! have_cmd jaeger; then
    info "Jaeger all-in-one is typically run as a container: docker run jaegertracing/all-in-one"
  fi
}

_sre_dr_backup() {
  step "Disaster recovery & backup CLIs"

  # velero
  if ! have_cmd velero; then
    install_github_release "vmware-tanzu/velero" "velero" \
      "velero-v[0-9.]+-linux-$(go_arch)\\.tar\\.gz" || true
  fi

  # k10 by kasten — proprietary skip
  # restic/rclone via packages

  # s5cmd (fast S3)
  if ! have_cmd s5cmd; then
    install_github_release "peak/s5cmd" "s5cmd" \
      "s5cmd_.*_Linux-64bit\\.tar\\.gz" || true
  fi

  # mc (minio client)
  if ! have_cmd mc; then
    install_raw_binary \
      "https://dl.min.io/client/mc/release/linux-$(go_arch)/mc" \
      "mc" || true
  fi
}
