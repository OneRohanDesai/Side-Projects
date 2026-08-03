#!/usr/bin/env bash
# Module: shell (zsh) + git + tmux + starship configs

module_shell() {
  header "Shell & developer environment files"

  deploy_file "${BABY_ROOT}/configs/shell/zshrc" "$HOME/.zshrc"
  deploy_file "${BABY_ROOT}/configs/shell/bashrc" "$HOME/.bashrc"
  deploy_file "${BABY_ROOT}/configs/tmux/tmux.conf" "$HOME/.tmux.conf"
  deploy_file "${BABY_ROOT}/configs/starship/starship.toml" "$HOME/.config/starship.toml"

  # Git config
  local git_name git_email
  if [[ -f "$HOME/.gitconfig" ]] && grep -q 'name\s*=' "$HOME/.gitconfig" 2>/dev/null; then
    info "Existing ~/.gitconfig found"
    if ask_yes_no "Overwrite git user config with Baby Linux template?" "no"; then
      :
    else
      ok "Kept existing gitconfig"
      set_default_shell "$(command -v zsh || echo /bin/zsh)"
      ok "Shell module complete"
      return 0
    fi
  fi

  ask_input "Git user.name" "${GIT_NAME:-Rohan Desai}"
  git_name="$REPLY_INPUT"
  ask_input "Git user.email" "${GIT_EMAIL:-pro.rohandesai@gmail.com}"
  git_email="$REPLY_INPUT"

  mkdir -p "$(dirname "$HOME/.gitconfig")"
  if [[ -f "$HOME/.gitconfig" ]]; then
    backup_path "$HOME/.gitconfig"
  fi
  sed \
    -e "s|@GIT_NAME@|${git_name}|g" \
    -e "s|@GIT_EMAIL@|${git_email}|g" \
    "${BABY_ROOT}/configs/git/gitconfig.template" >"$HOME/.gitconfig"
  ok "Wrote ~/.gitconfig for $git_name <$git_email>"

  if have_cmd zsh; then
    set_default_shell "$(command -v zsh)"
  else
    warn "zsh not installed — skip chsh"
  fi

  ok "Shell module complete"
}
