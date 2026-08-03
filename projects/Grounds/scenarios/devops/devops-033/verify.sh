#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
if [[ -f .git/MERGE_HEAD ]]; then err "merge still in progress"; exit 1; fi
grep -q 'version=2-resolved' config.txt && ok "resolved content" || { err "want version=2-resolved in config.txt"; exit 1; }
grep -qE '<<<<<<|>>>>>>|======' config.txt && { err "conflict markers remain"; exit 1; } || ok "no conflict markers"
