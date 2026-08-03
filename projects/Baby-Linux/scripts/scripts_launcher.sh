#!/usr/bin/env bash
# Baby Linux — rofi launcher for personal scripts
SCRIPTS_DIR="${BABY_HOME:-$HOME/Arch}/Scripts"
if [[ ! -d "$SCRIPTS_DIR" ]]; then
  notify-send "Error" "No such directory: $SCRIPTS_DIR" 2>/dev/null || echo "Missing $SCRIPTS_DIR"
  exit 1
fi
CHOICE=$(find "$SCRIPTS_DIR" -maxdepth 1 -type f -executable -printf "%f\n" 2>/dev/null | sort | rofi -dmenu -p "Run script:")
if [[ -n "$CHOICE" ]]; then
  "$SCRIPTS_DIR/$CHOICE" &
fi
