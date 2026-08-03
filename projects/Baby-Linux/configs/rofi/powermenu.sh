#!/usr/bin/env bash
# Baby Linux — rofi power menu

chosen=$(printf "Lock\nSleep\nLogout\nReboot\nShutdown" | rofi -dmenu -i -p "Power")

case "$chosen" in
  Lock)
    exec "${XDG_CONFIG_HOME:-$HOME/.config}/i3/lock.sh"
    ;;
  Sleep)
    systemctl sleep 2>/dev/null || systemctl suspend
    ;;
  Logout)
    i3-msg exit
    ;;
  Reboot)
    systemctl reboot
    ;;
  Shutdown)
    systemctl poweroff
    ;;
esac
