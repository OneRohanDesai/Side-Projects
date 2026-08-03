#!/usr/bin/env bash
# Baby Linux — notification sound
SOUND="${BABY_HOME:-$HOME/Arch}/notification.mp3"
[[ -f "$SOUND" ]] || SOUND="${XDG_DATA_HOME:-$HOME/.local/share}/baby-linux/sounds/notification.mp3"
if command -v mpg123 >/dev/null 2>&1 && [[ -f "$SOUND" ]]; then
  mpg123 -q "$SOUND" &
elif command -v paplay >/dev/null 2>&1 && [[ -f "$SOUND" ]]; then
  paplay "$SOUND" &
fi
