#!/usr/bin/env bash
# Baby Linux — lock screen (i3lock-color when available, else i3lock)

WALL="${BABY_HOME:-$HOME/Arch}/Wallpapers/lockscreen.png"
[[ -f "$WALL" ]] || WALL="${XDG_DATA_HOME:-$HOME/.local/share}/baby-linux/wallpapers/lockscreen.png"

if command -v i3lock >/dev/null 2>&1; then
  # i3lock-color extended flags (ignored by plain i3lock if unsupported — use subset)
  if i3lock --help 2>&1 | grep -q -- '--ring-color'; then
    i3lock \
      --image="$WALL" \
      --clock \
      --indicator \
      --force-clock \
      --show-failed-attempts \
      --ind-pos="ix-40:iy-120" \
      --time-str="%H:%M" \
      --date-str="%A, %d %B" \
      --radius=18 \
      --ring-width=2 \
      --inside-color=00000000 \
      --ring-color=ffffff22 \
      --line-color=00000000 \
      --separator-color=00000000 \
      --insidever-color=00000000 \
      --ringver-color=88c0d0ff \
      --insidewrong-color=00000000 \
      --ringwrong-color=ff5555ff \
      --keyhl-color=88c0d0ff \
      --bshl-color=ff5555ff \
      --time-color=ffffffff \
      --date-color=ddddddff \
      --verif-text="" \
      --wrong-text="" \
      --noinput-text="" \
      --lock-text="" \
      --lockfailed-text="" \
      --greeter-text="" \
      --nofork
  else
    i3lock -i "$WALL" -e -f --nofork
  fi
elif command -v betterlockscreen >/dev/null 2>&1; then
  betterlockscreen -l
else
  notify-send "Lock" "No lock utility found (i3lock)" 2>/dev/null || true
  exit 1
fi
