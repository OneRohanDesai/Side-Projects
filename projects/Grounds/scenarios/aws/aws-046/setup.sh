#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE/lambda"
cat >"$WORKSPACE/lambda/handler.py" <<'PY'
def handler(event, context):
    # S3 event notification handler
    records = (event or {}).get("Records", [])
    keys = []
    for r in records:
        keys.append(r.get("s3", {}).get("object", {}).get("key"))
    return {"processed": keys}
PY
( cd "$WORKSPACE/lambda" && python3 -c "import zipfile; zipfile.ZipFile("function.zip","w").write("handler.py")" )
aws_local s3 mb s3://nimbus-events 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-046 — Event-Driven Automation with S3 and Lambda

1. Create Lambda **nimbus-s3-processor** from lambda/function.zip
2. Allow S3 to invoke it (resource policy)
3. Configure bucket notification on nimbus-events for s3:ObjectCreated:*
4. Upload a test object and prove the function was invoked (or notification exists)

LocalStack notes: notification wiring can be partial — at minimum function + notification config must exist.
EOF
ok "Bucket nimbus-events ready"
