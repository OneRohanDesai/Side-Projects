#!/usr/bin/env bash
# Baby Linux — exit menu
chosen=$(printf "Lock\nSleep\nHibernate\nShutdown\nRestart\nLogout" | rofi -dmenu -i -p "System")
case "$chosen" in
  Lock)      exec "${XDG_CONFIG_HOME:-$HOME/.config}/i3/lock.sh" ;;
  Sleep)     systemctl suspend ;;
  Hibernate) systemctl hibernate ;;
  Shutdown)  systemctl poweroff ;;
  Restart)   systemctl reboot ;;
  Logout)    i3-msg exit ;;
  *)         exit 1 ;;
esac
