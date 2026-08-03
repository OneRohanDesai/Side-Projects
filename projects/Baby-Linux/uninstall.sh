#!/usr/bin/env bash
# Baby Linux — remove deployed configs (does NOT uninstall OS packages)
set -euo pipefail

BABY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${BABY_ROOT}/lib/common.sh"

banner
warn "This removes Baby Linux *configs* and optional ~/Arch assets."
warn "Installed packages (docker, i3, …) are left in place."
echo

ask_yes_no "Remove deployed dotfiles (with .bak restore if present)?" "no" || die "Aborted"

TARGETS=(
  "$HOME/.zshrc"
  "$HOME/.tmux.conf"
  "$HOME/.config/starship.toml"
  "$HOME/.config/i3/config"
  "$HOME/.config/i3/lock.sh"
  "$HOME/.config/i3status/config"
  "$HOME/.config/kitty/kitty.conf"
  "$HOME/.config/nvim/init.lua"
  "$HOME/.config/rofi/powermenu.sh"
  "$HOME/.config/dunst/dunstrc"
  "$HOME/.config/dunst/play_sound.sh"
  "$HOME/.config/flameshot/flameshot.ini"
)

for t in "${TARGETS[@]}"; do
  if [[ -e "$t" ]]; then
    backup_path "$t"
    ok "Removed $t (backed up if was a real file)"
  fi
done

if ask_yes_no "Also remove ${BABY_HOME:-$HOME/Arch}/Scripts and wallpapers deployed by Baby Linux?" "no"; then
  rm -rf "${BABY_HOME:-$HOME/Arch}/Scripts"
  warn "Left wallpapers intact (delete manually if desired)"
fi

ok "Uninstall of configs complete"
