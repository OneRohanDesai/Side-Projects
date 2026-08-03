#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/deploy-repo"
branch=$(git branch --show-current)
[[ "$branch" == "main" || "$branch" == "master" ]] && ok "on $branch" || { err "still detached or wrong branch ($branch)"; exit 1; }
