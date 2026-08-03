#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
aws_local s3 mb s3://nimbus-assets 2>/dev/null || true
echo hi | aws_local s3 cp - s3://nimbus-assets/hello.txt
aws_local iam create-user --user-name nimbus-app 2>/dev/null || true
# deliberately no policy
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-017 — S3 access denied after IAM change

User nimbus-app needs least-privilege access to s3://nimbus-assets/*.
Create and attach a policy allowing s3:GetObject, s3:PutObject, s3:ListBucket on that bucket.
Prove with aws s3 ls using that user (create access keys) or document policy ARN + simulation.

At minimum: managed policy NimbusAssetsAccess attached to nimbus-app.
EOF
ok "Restore S3 access for nimbus-app"
