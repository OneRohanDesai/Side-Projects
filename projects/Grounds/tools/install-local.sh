#!/usr/bin/env bash
# Optional helpers: awscli v2 via pip, ensure PATH
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Grounds root: $ROOT"

if ! command -v aws >/dev/null 2>&1; then
  echo "Installing awscli via pip (user)…"
  python3 -m pip install --user awscli 2>/dev/null \
    || python3 -m pip install --user awscliv2 2>/dev/null \
    || echo "Could not install awscli — docker fallback will be used"
fi

# shell snippet
mkdir -p "$HOME/.local/bin"
ln -sfn "$ROOT/bin/grounds" "$HOME/.local/bin/grounds"
echo "Linked grounds → ~/.local/bin/grounds"
echo "Ensure ~/.local/bin is on your PATH."
echo
echo "Try: grounds doctor"
