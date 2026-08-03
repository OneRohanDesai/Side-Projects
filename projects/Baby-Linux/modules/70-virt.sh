#!/usr/bin/env bash
# Module: QEMU/KVM + libvirt + virt-manager

module_virt() {
  header "Virtualization (QEMU/KVM + libvirt)"

  install_profile_packages virt

  if [[ "$INIT_SYSTEM" == "systemd" ]]; then
    enable_service libvirtd.service 2>/dev/null || enable_service libvirtd 2>/dev/null || true
  fi

  ensure_groups libvirt kvm libvirtd 2>/dev/null || ensure_groups libvirt kvm

  # Default NAT network
  if have_cmd virsh; then
    run_root virsh net-autostart default 2>/dev/null || true
    run_root virsh net-start default 2>/dev/null || true
  fi

  ok "Virt module complete — re-login for group membership"
}
