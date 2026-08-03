#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE/lambda"
cat >"$WORKSPACE/lambda/handler.py" <<'PY'
def handler(event, context):
    name = (event or {}).get("name", "world")
    return {"statusCode": 200, "body": f"hello {name} from nimbus"}
PY
( cd "$WORKSPACE/lambda" && python3 -c "import zipfile; zipfile.ZipFile("function.zip","w").write("handler.py")" )
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-033 — AWS Lambda Function Creation

Create Lambda function **nimbus-hello**:
- Runtime: python3.12 (or python3.11 if LocalStack requires)
- Handler: handler.handler
- Zip: workspace/lambda/function.zip (already built)
- Role: any IAM role ARN LocalStack accepts (create nimbus-lambda-role)

Invoke with `{"name":"grounds"}` and save result to invoke.json.
EOF
ok "Lambda package ready at workspace/lambda/function.zip"
