#!/usr/bin/env bash
# Baby Linux — i3 theme switcher (colors + wallpaper label)
# Requires wallpapers under $BABY_HOME/Wallpapers or uses fixed.jpg fallback

BABY_HOME="${BABY_HOME:-$HOME/Arch}"
I3_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/i3/config"
WP_DIR="$BABY_HOME/Wallpapers"

set_wp() {
  local img="$1"
  if [[ -f "$img" ]]; then
    xwallpaper --zoom "$img" 2>/dev/null || feh --bg-fill "$img" 2>/dev/null || true
  elif [[ -f "$WP_DIR/fixed.jpg" ]]; then
    xwallpaper --zoom "$WP_DIR/fixed.jpg" 2>/dev/null || feh --bg-fill "$WP_DIR/fixed.jpg" 2>/dev/null || true
  fi
}

apply_colors() {
  # $1 focused bg/fg etc — simplified: only reload; full theme sed kept optional
  i3-msg reload >/dev/null 2>&1 || true
}

chosen=$(printf "Zen\nCyberpunk Neon\nGreen Machine\nWar - Beautiful Death\nBlade Runner Noir\nJoi\nSilmarils" | rofi -dmenu -p "Select Theme")
[[ -z "$chosen" ]] && exit 0

case "$chosen" in
  "Zen")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #2e3440 #88c0d0 #2e3440 #88c0d0 #88c0d0/' "$I3_CFG"
    ;;
  "Cyberpunk Neon")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #1f002f #ff00f7 #1f002f #ff00f7 #ff00f7/' "$I3_CFG"
    ;;
  "Green Machine")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #0f3d0f #39ff14 #0f3d0f #39ff14 #39ff14/' "$I3_CFG"
    ;;
  "War - Beautiful Death")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #2b1b17 #e63946 #2b1b17 #e63946 #e63946/' "$I3_CFG"
    ;;
  "Blade Runner Noir")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #1a1a40 #00ffe7 #1a1a40 #00ffe7 #00ffe7/' "$I3_CFG"
    ;;
  "Joi")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #2c003e #f69cd8 #2c003e #f69cd8 #f69cd8/' "$I3_CFG"
    ;;
  "Silmarils")
    set_wp "$WP_DIR/fixed.jpg"
    sed -i 's/client.focused.*/client.focused          #0a0a23 #a3f7ff #0a0a23 #a3f7ff #a3f7ff/' "$I3_CFG"
    ;;
esac

i3-msg reload
notify-send "Theme" "Applied: $chosen" 2>/dev/null || true
