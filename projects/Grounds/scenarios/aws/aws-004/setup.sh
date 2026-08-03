#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
# Ensure bucket exists without versioning for the student to enable
aws_local s3 mb s3://nimbus-versioned 2>/dev/null || true
aws_local s3api put-bucket-versioning --bucket nimbus-versioned --versioning-configuration Status=Suspended 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-004 — S3 Bucket Versioning

Enable **versioning** on bucket `nimbus-versioned`.

Then upload a file twice and prove two versions exist (save output to versions.json).
EOF
ok "Bucket nimbus-versioned ready (versioning currently off/suspended)"
