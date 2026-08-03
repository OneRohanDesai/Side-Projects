#!/usr/bin/env bash
# Module: i3 desktop stack + display manager

module_desktop() {
  header "Desktop environment (i3)"

  install_profile_packages desktop-i3

  # Configs with path rendering
  render_template "${BABY_ROOT}/configs/i3/config" "$HOME/.config/i3/config"
  deploy_file "${BABY_ROOT}/configs/i3/lock.sh" "$HOME/.config/i3/lock.sh" 755
  deploy_file "${BABY_ROOT}/configs/i3/quote.txt" "$HOME/.config/i3/quote.txt"
  render_template "${BABY_ROOT}/configs/i3status/config" "$HOME/.config/i3status/config"
  deploy_file "${BABY_ROOT}/configs/kitty/kitty.conf" "$HOME/.config/kitty/kitty.conf"
  deploy_file "${BABY_ROOT}/configs/rofi/powermenu.sh" "$HOME/.config/rofi/powermenu.sh" 755
  render_template "${BABY_ROOT}/configs/dunst/dunstrc" "$HOME/.config/dunst/dunstrc"
  deploy_file "${BABY_ROOT}/configs/dunst/play_sound.sh" "$HOME/.config/dunst/play_sound.sh" 755
  render_template "${BABY_ROOT}/configs/flameshot/flameshot.ini" "$HOME/.config/flameshot/flameshot.ini"
  deploy_file "${BABY_ROOT}/configs/nvim/init.lua" "$HOME/.config/nvim/init.lua"

  # Assets → ~/Arch (Baby home layout)
  mkdir -p "$BABY_HOME/Wallpapers" "$BABY_HOME/Scripts"
  cp -n "${BABY_ROOT}/assets/wallpapers/"* "$BABY_HOME/Wallpapers/" 2>/dev/null || \
    cp "${BABY_ROOT}/assets/wallpapers/"* "$BABY_HOME/Wallpapers/"
  cp "${BABY_ROOT}/assets/sounds/notification.mp3" "$BABY_HOME/notification.mp3"
  # Also mirror into XDG share
  mkdir -p "$BABY_SHARE/wallpapers" "$BABY_SHARE/sounds"
  cp "${BABY_ROOT}/assets/wallpapers/"* "$BABY_SHARE/wallpapers/"
  cp "${BABY_ROOT}/assets/sounds/notification.mp3" "$BABY_SHARE/sounds/"

  # Scripts
  local s
  for s in "${BABY_ROOT}/scripts/"*; do
    [[ -f "$s" ]] || continue
    deploy_file "$s" "$BABY_HOME/Scripts/$(basename "$s")"
    chmod +x "$BABY_HOME/Scripts/$(basename "$s")" 2>/dev/null || true
    # Also expose key scripts on PATH
    case "$(basename "$s")" in
      scripts_launcher.sh|audio_switcher.sh|theme_switcher.sh|exit_menu.sh)
        deploy_file "$s" "$BABY_BIN/$(basename "$s")" 755
        ;;
    esac
  done

  # SDDM display manager
  if have_cmd sddm && [[ "$INIT_SYSTEM" == "systemd" ]]; then
    if ask_yes_no "Enable SDDM display manager (graphical login)?" "yes"; then
      enable_service sddm.service
    fi
  fi

  # NetworkManager + bluetooth
  enable_service NetworkManager.service 2>/dev/null || enable_service NetworkManager 2>/dev/null || true
  enable_service bluetooth.service 2>/dev/null || true

  # PipeWire user services (usually socket-activated)
  if [[ "$INIT_SYSTEM" == "systemd" ]]; then
    systemctl --user enable --now pipewire pipewire-pulse wireplumber 2>/dev/null || true
  fi

  # Screenshots dir
  mkdir -p "$HOME/Pictures/Screenshots"

  # AUR extras for Arch (i3lock-color etc.)
  if [[ "$PM" == "pacman" ]] && ask_yes_no "Install AUR desktop extras (i3lock-color, chrome, …)?" "yes"; then
    aur_install_file "${BABY_ROOT}/packages/arch/aur.txt"
  fi

  ok "Desktop module complete"
}
