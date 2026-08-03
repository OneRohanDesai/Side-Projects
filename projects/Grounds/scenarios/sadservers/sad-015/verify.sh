#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
[[ -f "$WORKSPACE/NOTES.md" ]] && grep -qiE 'jwt|ntp|chrony|skew' "$WORKSPACE/NOTES.md" && ok "notes ok" || { err "NOTES.md incomplete"; exit 1; }
[[ -f "$WORKSPACE/check_skew.py" ]] && ok "script present" || { err "check_skew.py missing"; exit 1; }
