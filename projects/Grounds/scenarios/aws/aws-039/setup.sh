#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE/site"
cat >"$WORKSPACE/site/index.html" <<'EOF'
<!DOCTYPE html><html><head><title>Nimbus Static</title></head>
<body><h1>Nimbus static site</h1><p>Served from S3 via LocalStack</p></body></html>
EOF
aws_local s3 mb s3://nimbus-static 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-039 — Static Website Hosting on Amazon S3

1. Upload site/ to s3://nimbus-static
2. Enable static website hosting with index document index.html
3. Save website endpoint to website-url.txt
EOF
ok "Static site files ready — host them on S3"
