#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
[[ -f "$WORKSPACE/NOTES.md" ]] && ok "NOTES.md present" || { err "write NOTES.md"; exit 1; }
grep -qiE 'cgroup|limit|kubernetes|ulimit|oom' "$WORKSPACE/NOTES.md" && ok "notes mention limits" || { err "notes too thin"; exit 1; }
