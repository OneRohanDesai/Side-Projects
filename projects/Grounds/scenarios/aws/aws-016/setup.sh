#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-016 — IAM User Creation

Create IAM user **nimbus-deploy** with tags:
- project=nimbus
- role=deploy

Save the username confirmation to user.json via `aws iam get-user`.
EOF
ok "Create IAM user nimbus-deploy"
