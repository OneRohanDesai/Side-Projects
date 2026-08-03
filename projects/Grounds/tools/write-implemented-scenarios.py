#!/usr/bin/env python3
"""Write setup.sh / verify.sh / HINTS.md for fully-implemented scenarios."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SC = ROOT / "scenarios"

def w(path: Path, content: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.lstrip("\n") if content.startswith("\n") else content, encoding="utf-8")
    if path.suffix == ".sh":
        path.chmod(0o755)


# ═══════════════════════════════════════════════════════════════════════════
# AWS (LocalStack)
# ═══════════════════════════════════════════════════════════════════════════

w(SC / "aws/aws-001/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=/dev/null
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-001 — AWS Key Pair Creation

Create an EC2 key pair named **nimbus-key** in LocalStack.

## Constraints
- Name must be exactly `nimbus-key`
- Save the private key material to `nimbus-key.pem` in this workspace
- chmod 400 the pem file

## Hints
```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
aws ec2 create-key-pair --key-name nimbus-key --query 'KeyMaterial' --output text > nimbus-key.pem
```
EOF
ok "Workspace ready. Create key pair nimbus-key against LocalStack."
''')

w(SC / "aws/aws-001/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
if [[ ! -f "$WORKSPACE/nimbus-key.pem" ]]; then err "missing $WORKSPACE/nimbus-key.pem"; fail=1; fi
if [[ -f "$WORKSPACE/nimbus-key.pem" ]]; then
  mode=$(stat -c '%a' "$WORKSPACE/nimbus-key.pem" 2>/dev/null || stat -f '%A' "$WORKSPACE/nimbus-key.pem")
  if [[ "$mode" != "400" && "$mode" != "600" ]]; then warn "pem mode is $mode (prefer 400)"; fi
fi
names=$(aws_local ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output text 2>/dev/null || true)
if echo "$names" | tr '\t' '\n' | grep -qx 'nimbus-key'; then
  ok "key pair nimbus-key exists in LocalStack"
else
  err "key pair nimbus-key not found (got: $names)"; fail=1
fi
exit $fail
''')

w(SC / "aws/aws-001/HINTS.md", """
# Hints aws-001
Use LocalStack endpoint http://localhost:4566 with dummy credentials test/test.
---
aws --endpoint-url=http://localhost:4566 ec2 create-key-pair --key-name nimbus-key --query KeyMaterial --output text > nimbus-key.pem && chmod 400 nimbus-key.pem
---
Verify with: aws --endpoint-url=http://localhost:4566 ec2 describe-key-pairs
""")

w(SC / "aws/aws-002/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-002 — Security Group Configuration

Create a security group named **nimbus-web-sg** that:
- Description: "Nimbus web tier"
- Allows inbound TCP 80 and 443 from 0.0.0.0/0
- Allows inbound TCP 22 from 10.0.0.0/8
- Allows all outbound

Write the GroupId to `sg-id.txt`.
EOF
ok "Create security group nimbus-web-sg"
''')

w(SC / "aws/aws-002/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
# Find SG by name (LocalStack may use default VPC)
sg_json=$(aws_local ec2 describe-security-groups --filters Name=group-name,Values=nimbus-web-sg --output json 2>/dev/null || echo '{"SecurityGroups":[]}')
count=$(echo "$sg_json" | jq '.SecurityGroups|length')
if [[ "$count" -lt 1 ]]; then err "security group nimbus-web-sg not found"; exit 1; fi
ok "security group exists"
perms=$(echo "$sg_json" | jq -c '.[0].IpPermissions // .SecurityGroups[0].IpPermissions')
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==80 and .ToPort==80)' >/dev/null \
  && ok "ingress :80" || { err "missing ingress tcp/80"; fail=1; }
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==443 and .ToPort==443)' >/dev/null \
  && ok "ingress :443" || { err "missing ingress tcp/443"; fail=1; }
echo "$sg_json" | jq -e '.SecurityGroups[0].IpPermissions[] | select(.FromPort==22)' >/dev/null \
  && ok "ingress :22" || { err "missing ingress tcp/22"; fail=1; }
if [[ -f "$WORKSPACE/sg-id.txt" ]]; then ok "sg-id.txt present"; else warn "sg-id.txt missing (optional but recommended)"; fi
exit $fail
''')

w(SC / "aws/aws-002/HINTS.md", """
# Hints
Create default VPC SG then authorize ingress.
---
aws --endpoint-url=http://localhost:4566 ec2 create-security-group --group-name nimbus-web-sg --description 'Nimbus web tier'
aws --endpoint-url=http://localhost:4566 ec2 authorize-security-group-ingress --group-name nimbus-web-sg --protocol tcp --port 80 --cidr 0.0.0.0/0
# repeat for 443 and 22 (10.0.0.0/8)
""")

w(SC / "aws/aws-004/setup.sh", r'''
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
''')

w(SC / "aws/aws-004/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
status=$(aws_local s3api get-bucket-versioning --bucket nimbus-versioned --query Status --output text 2>/dev/null || echo none)
if [[ "$status" == "Enabled" ]]; then ok "versioning Enabled"; else err "versioning is '$status' (want Enabled)"; exit 1; fi
''')

w(SC / "aws/aws-016/setup.sh", r'''
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
''')

w(SC / "aws/aws-016/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
aws_local iam get-user --user-name nimbus-deploy >/dev/null
ok "user nimbus-deploy exists"
''')

w(SC / "aws/aws-018/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
# ensure user exists from path
aws_local iam create-user --user-name nimbus-readonly 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-018 — Read-Only IAM Policy for EC2 Access

Create a customer-managed policy named **NimbusEC2ReadOnly** that allows only:
- ec2:Describe*
- ec2:List*

Attach it to user `nimbus-readonly`.
Save policy ARN to policy-arn.txt.
EOF
ok "User nimbus-readonly ready — create and attach read-only EC2 policy"
''')

w(SC / "aws/aws-018/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
pols=$(aws_local iam list-policies --scope Local --query 'Policies[?PolicyName==`NimbusEC2ReadOnly`].Arn' --output text)
if [[ -z "$pols" ]]; then err "policy NimbusEC2ReadOnly not found"; exit 1; fi
ok "policy exists: $pols"
attached=$(aws_local iam list-attached-user-policies --user-name nimbus-readonly --query 'AttachedPolicies[].PolicyName' --output text)
echo "$attached" | tr '\t' '\n' | grep -qx NimbusEC2ReadOnly && ok "attached to nimbus-readonly" || { err "not attached"; fail=1; }
exit $fail
''')

w(SC / "aws/aws-023/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE/data"
echo "nimbus asset $(date -Iseconds)" >"$WORKSPACE/data/asset.txt"
echo "orders export" >"$WORKSPACE/data/orders.csv"
aws_local s3 mb s3://nimbus-src 2>/dev/null || true
aws_local s3 mb s3://nimbus-dst 2>/dev/null || true
aws_local s3 cp "$WORKSPACE/data/asset.txt" s3://nimbus-src/asset.txt
aws_local s3 cp "$WORKSPACE/data/orders.csv" s3://nimbus-src/orders.csv
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-023 — S3 Bucket Data Migration Using AWS CLI

Migrate all objects from `s3://nimbus-src` → `s3://nimbus-dst` using AWS CLI
(sync or cp --recursive). Destination must contain the same keys.
EOF
ok "Source bucket seeded. Migrate src → dst."
''')

w(SC / "aws/aws-023/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
for key in asset.txt orders.csv; do
  if aws_local s3 ls "s3://nimbus-dst/$key" >/dev/null 2>&1; then ok "dst has $key"
  else err "missing s3://nimbus-dst/$key"; fail=1; fi
done
exit $fail
''')

w(SC / "aws/aws-033/setup.sh", r'''
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
( cd "$WORKSPACE/lambda" && zip -q function.zip handler.py )
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
''')

w(SC / "aws/aws-033/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
aws_local lambda get-function --function-name nimbus-hello >/dev/null
ok "function nimbus-hello exists"
out=$(aws_local lambda invoke --function-name nimbus-hello --payload '{"name":"grounds"}' "$WORKSPACE/invoke-verify.json" --query StatusCode --output text 2>/dev/null || echo fail)
if [[ "$out" == "200" ]]; then ok "invoke ok"; else err "invoke failed"; exit 1; fi
if grep -q 'grounds' "$WORKSPACE/invoke-verify.json" 2>/dev/null; then ok "payload greets grounds"; else warn "check response body"; fi
''')

w(SC / "aws/aws-039/setup.sh", r'''
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
''')

w(SC / "aws/aws-039/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local s3 ls s3://nimbus-static/index.html >/dev/null 2>&1 && ok "index.html uploaded" || { err "index.html missing"; fail=1; }
cfg=$(aws_local s3api get-bucket-website --bucket nimbus-static 2>/dev/null || echo '{}')
echo "$cfg" | jq -e '.IndexDocument.Suffix == "index.html"' >/dev/null && ok "website hosting configured" || { err "website config missing"; fail=1; }
exit $fail
''')

w(SC / "aws/aws-042/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-042 — NoSQL Database Management with DynamoDB

Create DynamoDB table **nimbus-orders**:
- Partition key: order_id (S)
- Sort key: created_at (S)  [optional but preferred]
- Billing mode: PAY_PER_REQUEST

Put at least 2 sample order items, then query/scan and save to scan.json.
EOF
ok "Create DynamoDB table nimbus-orders"
''')

w(SC / "aws/aws-042/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
status=$(aws_local dynamodb describe-table --table-name nimbus-orders --query 'Table.TableStatus' --output text)
[[ "$status" == "ACTIVE" ]] && ok "table ACTIVE" || { err "table status $status"; exit 1; }
count=$(aws_local dynamodb scan --table-name nimbus-orders --select COUNT --query Count --output text)
if [[ "${count:-0}" -ge 2 ]]; then ok "items: $count"; else err "need >=2 items (have $count)"; exit 1; fi
''')

w(SC / "aws/aws-046/setup.sh", r'''
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
( cd "$WORKSPACE/lambda" && zip -q function.zip handler.py )
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
''')

w(SC / "aws/aws-046/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local lambda get-function --function-name nimbus-s3-processor >/dev/null && ok "lambda exists" || { err "lambda missing"; fail=1; }
notif=$(aws_local s3api get-bucket-notification-configuration --bucket nimbus-events 2>/dev/null || echo '{}')
echo "$notif" | jq -e '.LambdaFunctionConfigurations | length >= 1' >/dev/null \
  && ok "notification configured" || { err "no lambda notification on bucket"; fail=1; }
exit $fail
''')

w(SC / "aws/aws-047/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-047 — Reliable Messaging with SQS and SNS

1. Create SNS topic **nimbus-alerts**
2. Create SQS queue **nimbus-alerts-queue**
3. Subscribe the queue to the topic
4. Publish a message "nimbus-health-ok" to the topic
5. Receive it from the queue (save body to message.txt)
EOF
ok "Build SNS→SQS fan-in for nimbus alerts"
''')

w(SC / "aws/aws-047/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
aws_local sns list-topics | grep -q nimbus-alerts && ok "topic exists" || { err "topic missing"; fail=1; }
aws_local sqs get-queue-url --queue-name nimbus-alerts-queue >/dev/null && ok "queue exists" || { err "queue missing"; fail=1; }
if [[ -f "$WORKSPACE/message.txt" ]] && grep -q 'nimbus-health-ok' "$WORKSPACE/message.txt"; then
  ok "message received"
else
  # soft: try receive now
  url=$(aws_local sqs get-queue-url --queue-name nimbus-alerts-queue --query QueueUrl --output text 2>/dev/null || true)
  if [[ -n "$url" ]]; then
    aws_local sqs receive-message --queue-url "$url" --max-number-of-messages 1 >"$WORKSPACE/recv.json" || true
    if grep -q nimbus-health-ok "$WORKSPACE/recv.json" 2>/dev/null; then ok "message in queue"; else err "message not found — publish + receive"; fail=1; fi
  else
    fail=1
  fi
fi
exit $fail
''')

w(SC / "aws/aws-048/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/template.yaml" <<'YAML'
AWSTemplateFormatVersion: '2010-09-09'
Description: Nimbus starter stack for Grounds
Parameters:
  BucketName:
    Type: String
    Default: nimbus-cfn-assets
Resources:
  AssetsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
  JobsQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: nimbus-cfn-jobs
Outputs:
  BucketName:
    Value: !Ref AssetsBucket
  QueueUrl:
    Value: !Ref JobsQueue
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# aws-048 — Infrastructure Automation with CloudFormation

Deploy template.yaml as stack **nimbus-starter** to LocalStack.

```bash
aws cloudformation deploy --stack-name nimbus-starter \
  --template-file template.yaml \
  --endpoint-url http://localhost:4566
```

(or create-stack + wait). Confirm bucket and queue exist.
EOF
ok "CloudFormation template ready — deploy nimbus-starter"
''')

w(SC / "aws/aws-048/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
st=$(aws_local cloudformation describe-stacks --stack-name nimbus-starter --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo MISSING)
echo "$st" | grep -qE 'CREATE_COMPLETE|UPDATE_COMPLETE' && ok "stack $st" || { err "stack status: $st"; fail=1; }
aws_local s3 ls s3://nimbus-cfn-assets >/dev/null 2>&1 && ok "bucket exists" || { err "bucket nimbus-cfn-assets missing"; fail=1; }
aws_local sqs get-queue-url --queue-name nimbus-cfn-jobs >/dev/null 2>&1 && ok "queue exists" || { err "queue missing"; fail=1; }
exit $fail
''')

# ═══════════════════════════════════════════════════════════════════════════
# DevOps
# ═══════════════════════════════════════════════════════════════════════════

w(SC / "devops/devops-001/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# clean previous
docker exec grounds-linux-lab bash -c 'userdel -r amanda 2>/dev/null || true' || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-001 — Linux User Creation with Non-Interactive Shell

Inside the Linux lab (`grounds shell` or `docker exec -it grounds-linux-lab bash`):

Create user **amanda** with:
- non-interactive shell (`/sbin/nologin` or `/usr/sbin/nologin`)
- home directory present
- comment/gecos: "Amanda App Service"

Do NOT set a password (service account style).
EOF
ok "Linux lab ready — create user amanda"
''')

w(SC / "devops/devops-001/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker exec grounds-linux-lab id amanda >/dev/null 2>&1 || { err "user amanda missing"; exit 1; }
shell=$(docker exec grounds-linux-lab getent passwd amanda | cut -d: -f7)
echo "$shell" | grep -qE 'nologin|false' && ok "shell=$shell" || { err "shell should be nologin (got $shell)"; fail=1; }
home=$(docker exec grounds-linux-lab getent passwd amanda | cut -d: -f6)
docker exec grounds-linux-lab test -d "$home" && ok "home $home" || { err "home missing"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-002/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c 'userdel -r tempuser 2>/dev/null || true' || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-002 — Temporary User Account Setup with Expiry

Create user **tempuser** that expires in 30 days (use `chage` or `useradd -e`).
EOF
ok "Create expiring user tempuser"
''')

w(SC / "devops/devops-002/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab id tempuser >/dev/null
exp=$(docker exec grounds-linux-lab chage -l tempuser | grep -i 'Account expires' || true)
echo "$exp" | grep -viq 'never' && ok "expiry set: $exp" || { err "account expires should not be never"; exit 1; }
''')

w(SC / "devops/devops-004/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /opt/scripts
  echo "#!/bin/bash" > /opt/scripts/backup.sh
  echo "echo backup" >> /opt/scripts/backup.sh
  chmod 777 /opt/scripts/backup.sh
  chown root:root /opt/scripts/backup.sh
'
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-004 — Linux Script Permission Management

Fix /opt/scripts/backup.sh permissions to be production-safe:
- owner root, group student (or a dedicated group)
- mode 750 (rwxr-x---) — executable by owner/group only, not world
EOF
ok "Broken permissions applied — harden backup.sh"
''')

w(SC / "devops/devops-004/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mode=$(docker exec grounds-linux-lab stat -c '%a' /opt/scripts/backup.sh)
[[ "$mode" == "750" || "$mode" == "740" || "$mode" == "700" ]] && ok "mode $mode" || { err "mode $mode unsafe (want 750/700)"; exit 1; }
# must not be world-writable or world-executable preferably
[[ "$mode" != "777" && "$mode" != "755" ]] || { err "still too open"; exit 1; }
ok "permissions hardened"
''')

w(SC / "devops/devops-006/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /var/practice
  echo "#!/bin/bash" > /var/practice/heartbeat.sh
  echo "date >> /var/practice/heartbeat.log" >> /var/practice/heartbeat.sh
  chmod +x /var/practice/heartbeat.sh
  # remove any existing cron
  crontab -r 2>/dev/null || true
  rm -f /etc/cron.d/heartbeat
'
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-006 — Cron Job Scheduling in Linux

Schedule /var/practice/heartbeat.sh to run every 2 minutes as root.
Use either root crontab or /etc/cron.d/heartbeat.
EOF
ok "Schedule heartbeat cron"
''')

w(SC / "devops/devops-006/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
found=0
docker exec grounds-linux-lab bash -c 'crontab -l 2>/dev/null; cat /etc/cron.d/* 2>/dev/null' | grep -q heartbeat && found=1 || true
if [[ $found -eq 1 ]]; then ok "cron entry references heartbeat"; else err "no cron entry for heartbeat"; exit 1; fi
''')

w(SC / "devops/devops-010/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-010 — Bash Scripting Fundamentals

Write `count_orders.sh` in this workspace that:
1. Accepts a CSV path as $1 (sample: sample.csv)
2. Skips the header line
3. Prints the number of data rows
4. Exits 2 if file missing

Sample CSV is provided as sample.csv
EOF
cat >"$WORKSPACE/sample.csv" <<'CSV'
id,customer,total
1,alice,10
2,bob,20
3,carol,30
CSV
ok "Write count_orders.sh"
''')

w(SC / "devops/devops-010/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -x "$WORKSPACE/count_orders.sh" || -f "$WORKSPACE/count_orders.sh" ]] || { err "script missing"; exit 1; }
chmod +x "$WORKSPACE/count_orders.sh"
out=$(bash "$WORKSPACE/count_orders.sh" "$WORKSPACE/sample.csv" | tr -dc '0-9')
[[ "$out" == "3" ]] && ok "count=3" || { err "expected 3 got '$out'"; fail=1; }
set +e
bash "$WORKSPACE/count_orders.sh" /no/such/file >/dev/null 2>&1
rc=$?
set -e
[[ $rc -eq 2 ]] && ok "exit 2 on missing file" || { err "expected exit 2 on missing (got $rc)"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-021/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# create bare repo on host workspace simulating storage server
git init --bare "$WORKSPACE/nimbus.git" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-021 — Git Repository Setup on Storage Server

A bare repo already exists at nimbus.git (simulating storage server).

1. Clone it to `nimbus-work`
2. Add a README.md committing as user "Student <student@grounds.local>"
3. Push main/master branch back to the bare repo
EOF
ok "Bare repo at workspace/nimbus.git"
''')

w(SC / "devops/devops-021/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
git --git-dir="$WORKSPACE/nimbus.git" rev-parse HEAD >/dev/null 2>&1 && ok "bare repo has commits" || { err "no commits on bare repo"; fail=1; }
git --git-dir="$WORKSPACE/nimbus.git" cat-file -e HEAD:README.md 2>/dev/null && ok "README.md in repo" || { err "README.md missing in bare repo"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-024/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "base" > app.txt
git add app.txt && git commit -m "init" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-024 — Git Branch Creation and Management

In workspace/repo:
1. Create branch `feature/payments`
2. Add payments.py with a function charge()
3. Commit on that branch
4. Ensure main does NOT contain payments.py yet
EOF
ok "Repo ready — create feature/payments branch"
''')

w(SC / "devops/devops-024/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
fail=0
git rev-parse --verify feature/payments >/dev/null && ok "branch exists" || { err "branch feature/payments missing"; fail=1; }
git cat-file -e feature/payments:payments.py 2>/dev/null && ok "payments.py on feature" || { err "payments.py missing on feature"; fail=1; }
if git cat-file -e main:payments.py 2>/dev/null; then err "payments.py should not be on main yet"; fail=1; else ok "main clean of feature file"; fi
exit $fail
''')

w(SC / "devops/devops-025/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
rm -rf .git 2>/dev/null || true
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "base" > app.txt
git add app.txt && git commit -m "init" >/dev/null
git checkout -b feature/payments >/dev/null
echo 'def charge(): return 42' > payments.py
git add payments.py && git commit -m "add payments" >/dev/null
git checkout main >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-025 — Git Branch Merging

Merge `feature/payments` into `main` (no FF preferred but not required).
Main must contain payments.py after merge.
EOF
ok "Merge feature/payments into main"
''')

w(SC / "devops/devops-025/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
git checkout main >/dev/null
git cat-file -e main:payments.py && ok "payments.py on main" || { err "not merged"; exit 1; }
''')

w(SC / "devops/devops-033/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/repo"
cd "$WORKSPACE/repo"
rm -rf .git
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo "version=1" > config.txt
git add config.txt && git commit -m "base" >/dev/null
git checkout -b feature/a >/dev/null
echo "version=2a" > config.txt
git add config.txt && git commit -m "a" >/dev/null
git checkout main >/dev/null
git checkout -b feature/b >/dev/null
echo "version=2b" > config.txt
git add config.txt && git commit -m "b" >/dev/null
git checkout main >/dev/null
git merge feature/a -m "merge a" >/dev/null
set +e
git merge feature/b -m "merge b" >/dev/null 2>&1
set -e
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-033 — Resolving Git Merge Conflicts

feature/b merge into main conflicts on config.txt.
Resolve the conflict so the file contains `version=2-resolved`, commit the merge.
EOF
ok "Conflict induced — resolve it"
''')

w(SC / "devops/devops-033/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/repo"
if [[ -f .git/MERGE_HEAD ]]; then err "merge still in progress"; exit 1; fi
grep -q 'version=2-resolved' config.txt && ok "resolved content" || { err "want version=2-resolved in config.txt"; exit 1; }
grep -qE '<<<<<<|>>>>>>|======' config.txt && { err "conflict markers remain"; exit 1; } || ok "no conflict markers"
''')

w(SC / "devops/devops-035/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-035 — Docker Installation and Service Management

On the host (you already have Docker), demonstrate service management:

1. Write `docker-status.sh` that prints `ok` if docker daemon is reachable
2. Ensure a container named `grounds-hello` runs `nginx:alpine` publishing 18081:80
3. Container must restart=unless-stopped
EOF
ok "Manage Docker service + hello container"
''')

w(SC / "devops/devops-035/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker info >/dev/null && ok "docker daemon ok" || { err "docker down"; fail=1; }
docker inspect grounds-hello >/dev/null 2>&1 && ok "container exists" || { err "grounds-hello missing"; fail=1; }
state=$(docker inspect -f '{{.State.Running}}' grounds-hello 2>/dev/null || echo false)
[[ "$state" == "true" ]] && ok "running" || { err "not running"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-036/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-nginx 2>/dev/null || true
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-036 — Nginx Container Deployment with Docker

Run nginx in Docker:
- name: grounds-nginx
- image: nginx:1.27-alpine
- publish 18082:80
- mount workspace/html → /usr/share/nginx/html:ro
- custom index.html saying "Nimbus via Docker"
EOF
mkdir -p "$WORKSPACE/html"
ok "Deploy nginx container with custom content"
''')

w(SC / "devops/devops-036/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
docker inspect grounds-nginx >/dev/null 2>&1 || { err "container missing"; exit 1; }
body=$(curl -sf http://localhost:18082/ || true)
echo "$body" | grep -qi nimbus && ok "content ok" || { err "content missing Nimbus"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-041/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/app"
cat >"$WORKSPACE/app/app.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers()
        self.wfile.write(b"nimbus-dockerfile-ok")
    def log_message(self, *args): pass
HTTPServer(("0.0.0.0", 8000), H).serve_forever()
PY
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-041 — Writing Dockerfiles

Write a Dockerfile for workspace/app that:
- uses python:3.12-slim
- runs app.py on port 8000
- HEALTHCHECK curls or wget localhost:8000

Build as `grounds-practice-app:1` and run as `grounds-practice-app` on host port 18083.
EOF
ok "Write Dockerfile and run the app"
''')

w(SC / "devops/devops-041/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -f "$WORKSPACE/app/Dockerfile" || -f "$WORKSPACE/Dockerfile" ]] && ok "Dockerfile present" || { err "Dockerfile missing"; fail=1; }
docker image inspect grounds-practice-app:1 >/dev/null 2>&1 && ok "image built" || { err "image grounds-practice-app:1 missing"; fail=1; }
body=$(curl -sf http://localhost:18083/ || true)
echo "$body" | grep -q nimbus-dockerfile-ok && ok "service responds" || { err "not responding on :18083"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-044/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# seed a minimal compose project for nimbus-lite
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-044 — Docker Compose File Creation

Create docker-compose.yml in this workspace that runs:
1. redis:7-alpine service name `cache`
2. a simple whoami (traefik/whoami) service name `web` publishing 18084:80
3. web depends_on cache

Bring the stack up with project name `grounds-compose-lab`.
EOF
ok "Author and start docker-compose.yml"
''')

w(SC / "devops/devops-044/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
[[ -f "$WORKSPACE/docker-compose.yml" || -f "$WORKSPACE/compose.yaml" ]] && ok "compose file exists" || { err "compose file missing"; fail=1; }
curl -sf http://localhost:18084/ >/dev/null && ok "web reachable" || { err "web not on :18084"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-046/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-046 — Application Deployment Using Docker Containers

Deploy the Nimbus production stack (or confirm it) and place a real order:

1. Ensure API health is ok at http://localhost:8080/health
2. POST an order for customer "devops-046" with product_id 1 qty 1
3. Save the JSON response to order.json in this workspace
EOF
ok "Deploy/use Nimbus and place an order"
''')

w(SC / "devops/devops-046/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
curl -sf http://localhost:8080/health | jq -e '.status=="ok" or .checks.api=="ok"' >/dev/null && ok "health" || { err "api unhealthy"; fail=1; }
if [[ -f "$WORKSPACE/order.json" ]] && jq -e '.customer=="devops-046" or .id' "$WORKSPACE/order.json" >/dev/null; then
  ok "order.json present"
else
  # try detect via API
  if curl -sf http://localhost:8080/orders | jq -e '.[]|select(.customer=="devops-046")' >/dev/null; then
    ok "order found via API"
  else
    err "no order for devops-046"; fail=1
  fi
fi
exit $fail
''')

w(SC / "devops/devops-048/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# ensure kind is up done by needs; copy manifests
cp -r "${GROUNDS_ROOT}/app/nimbus/k8s" "$WORKSPACE/"
# broken: wrong image pull policy scenario — student deploys a simple pod
cat >"$WORKSPACE/pod.yaml" <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: nimbus-trainer
  namespace: default
  labels:
    app: nimbus-trainer
spec:
  containers:
    - name: trainer
      image: nginx:1.27-alpine
      ports:
        - containerPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-048 — Kubernetes Pod Deployment

Using Kind context kind-grounds:
1. kubectl apply -f pod.yaml
2. Wait until Pod nimbus-trainer is Running
3. Save `kubectl get pod nimbus-trainer -o wide` to pod-status.txt
EOF
ok "Deploy pod nimbus-trainer on Kind"
''')

w(SC / "devops/devops-048/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
phase=$(kubectl --context kind-grounds get pod nimbus-trainer -o jsonpath='{.status.phase}' 2>/dev/null || echo Missing)
[[ "$phase" == "Running" ]] && ok "pod Running" || { err "phase=$phase"; exit 1; }
''')

w(SC / "devops/devops-049/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/deploy.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nimbus-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nimbus-web
  template:
    metadata:
      labels:
        app: nimbus-web
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-049 — Kubernetes Deployment Management

1. Apply deploy.yaml
2. Scale nimbus-web to 3 replicas
3. Expose it as ClusterIP service port 80
EOF
ok "Manage Deployment nimbus-web"
''')

w(SC / "devops/devops-049/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
rep=$(kubectl --context kind-grounds get deploy nimbus-web -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
[[ "${rep:-0}" -ge 3 ]] && ok "readyReplicas=$rep" || { err "need 3 ready (have $rep)"; fail=1; }
kubectl --context kind-grounds get svc nimbus-web >/dev/null 2>&1 && ok "service exists" || { err "service nimbus-web missing"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-050/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/deploy.yaml" <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nimbus-limited
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nimbus-limited
  template:
    metadata:
      labels:
        app: nimbus-limited
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
YAML
kubectl --context kind-grounds apply -f "$WORKSPACE/deploy.yaml" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-050 — Kubernetes Resource Limit Configuration

Patch deployment nimbus-limited so the container has:
- requests: cpu 50m, memory 64Mi
- limits: cpu 200m, memory 128Mi
EOF
ok "Add resource requests/limits"
''')

w(SC / "devops/devops-050/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cpu=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.limits.cpu}')
mem=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}')
[[ -n "$cpu" && -n "$mem" ]] && ok "limits cpu=$cpu mem=$mem" || { err "limits missing"; exit 1; }
req=$(kubectl --context kind-grounds get deploy nimbus-limited -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}')
[[ -n "$req" ]] && ok "requests set" || { err "requests missing"; exit 1; }
''')

w(SC / "devops/devops-062/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-062 — Kubernetes Secret Management

1. Create secret `nimbus-db` with keys username=nimbus password=s3cr3t
2. Create a pod `secret-consumer` that mounts the secret as env vars
3. Pod should use nginx:alpine and be Running
EOF
ok "Create and consume a K8s secret"
''')

w(SC / "devops/devops-062/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
fail=0
kubectl --context kind-grounds get secret nimbus-db >/dev/null && ok "secret exists" || { err "secret missing"; fail=1; }
# decode check
user=$(kubectl --context kind-grounds get secret nimbus-db -o jsonpath='{.data.username}' | base64 -d)
[[ "$user" == "nimbus" ]] && ok "username ok" || { err "username mismatch"; fail=1; }
phase=$(kubectl --context kind-grounds get pod secret-consumer -o jsonpath='{.status.phase}' 2>/dev/null || echo Missing)
[[ "$phase" == "Running" ]] && ok "pod Running" || { err "pod phase=$phase"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-082/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-082 — Ansible Inventory Creation for App Servers

Create inventory.ini (or hosts.yml) for the Ansible lab containers:
- group [app]: app01, app02
- group [db]: db01
- group [all:vars] with ansible_connection=docker and ansible_python_interpreter=/usr/bin/python3

Host names must match docker container names: grounds-app01, grounds-app02, grounds-db01
(or set ansible_host accordingly).
EOF
ok "Write Ansible inventory for lab hosts"
''')

w(SC / "devops/devops-082/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
inv=""
for f in inventory.ini hosts.ini inventory.yml hosts.yml inventory.yaml; do
  [[ -f "$WORKSPACE/$f" ]] && inv="$WORKSPACE/$f" && break
done
[[ -n "$inv" ]] || { err "no inventory file"; exit 1; }
ok "inventory: $inv"
# parse with ansible-inventory if possible
if command -v ansible-inventory >/dev/null; then
  ansible-inventory -i "$inv" --list >/tmp/grounds-inv.json
  jq -e '.app.children // .app.hosts // .all.children.app' /tmp/grounds-inv.json >/dev/null 2>&1 \
    || jq -e 'keys' /tmp/grounds-inv.json >/dev/null
  ok "ansible-inventory parses file"
fi
grep -qE 'app01|grounds-app01' "$inv" && ok "app hosts listed" || { err "app hosts missing"; exit 1; }
''')

w(SC / "devops/devops-086/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# seed inventory if missing
if [[ ! -f "$WORKSPACE/inventory.ini" ]]; then
  cat >"$WORKSPACE/inventory.ini" <<'INV'
[app]
grounds-app01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
grounds-app02 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
[db]
grounds-db01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
INV
fi
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-086 — Ansible Ping Module Usage

Run ansible ping against all inventory hosts and save output to ping.txt.
All three hosts must respond pong.
EOF
ok "Ping all ansible lab hosts"
''')

w(SC / "devops/devops-086/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# live verify by running ping if student file incomplete
inv="$WORKSPACE/inventory.ini"
if [[ -f "$WORKSPACE/ping.txt" ]] && grep -c pong "$WORKSPACE/ping.txt" | grep -qE '^[3-9]'; then
  ok "ping.txt shows pongs"
  exit 0
fi
out=$(ansible -i "$inv" all -m ping 2>/dev/null || true)
echo "$out" >"$WORKSPACE/ping-verify.txt"
pongs=$(echo "$out" | grep -c '"ping": "pong"' || true)
[[ "${pongs:-0}" -ge 3 ]] && ok "ansible ping pong x$pongs" || { err "need 3 pongs (got $pongs). Is ansible lab up?"; exit 1; }
''')

w(SC / "devops/devops-094/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/provider.tf" <<'EOF'
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true
  endpoints {
    ec2 = "http://localhost:4566"
    s3  = "http://localhost:4566"
    iam = "http://localhost:4566"
  }
}
EOF
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-094 — VPC Creation Using Terraform

Using the provided provider.tf (LocalStack), write main.tf that creates:
- aws_vpc.nimbus with cidr 10.20.0.0/16
- tags Name=nimbus-vpc

terraform init && terraform apply -auto-approve
EOF
ok "Create VPC with Terraform against LocalStack"
''')

w(SC / "devops/devops-094/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
[[ -f "$WORKSPACE/main.tf" || -f "$WORKSPACE/vpc.tf" ]] && ok "tf files present" || { err "main.tf missing"; fail=1; }
# check via AWS API
vpcs=$(aws_local ec2 describe-vpcs --filters Name=tag:Name,Values=nimbus-vpc --query 'Vpcs[].VpcId' --output text 2>/dev/null || true)
if [[ -z "$vpcs" || "$vpcs" == "None" ]]; then
  # also accept cidr match
  vpcs=$(aws_local ec2 describe-vpcs --query 'Vpcs[?CidrBlock==`10.20.0.0/16`].VpcId' --output text 2>/dev/null || true)
fi
[[ -n "$vpcs" && "$vpcs" != "None" ]] && ok "vpc exists: $vpcs" || { err "vpc not found"; fail=1; }
exit $fail
''')

w(SC / "devops/devops-095/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
# reuse provider if student runs sequentially
if [[ ! -f "$WORKSPACE/provider.tf" ]]; then
  cp "${GROUNDS_ROOT}/scenarios/devops/devops-094/../devops-094/provider.tf" "$WORKSPACE/provider.tf" 2>/dev/null || true
fi
if [[ ! -f "$WORKSPACE/provider.tf" ]]; then
  cat >"$WORKSPACE/provider.tf" <<'EOF'
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}
provider "aws" {
  region = "us-east-1"
  access_key = "test"
  secret_key = "test"
  skip_credentials_validation = true
  skip_metadata_api_check = true
  skip_requesting_account_id = true
  endpoints { ec2 = "http://localhost:4566" }
}
EOF
fi
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-095 — Security Group Configuration with Terraform

Create aws_security_group.nimbus_web allowing ingress 80/443 from 0.0.0.0/0.
Tag Name=nimbus-web-sg-tf
EOF
ok "Terraform a security group on LocalStack"
''')

w(SC / "devops/devops-095/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
sg=$(aws_local ec2 describe-security-groups --filters Name=tag:Name,Values=nimbus-web-sg-tf --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
[[ "$sg" != "None" && -n "$sg" ]] && ok "sg $sg" || {
  # fallback group name
  sg=$(aws_local ec2 describe-security-groups --filters Name=group-name,Values=nimbus-web-sg-tf --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
  [[ "$sg" != "None" && -n "$sg" ]] && ok "sg $sg" || { err "security group not found"; exit 1; }
}
''')

w(SC / "devops/devops-096/setup.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/provider.tf" <<'EOF'
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}
provider "aws" {
  region = "us-east-1"
  access_key = "test"
  secret_key = "test"
  skip_credentials_validation = true
  skip_metadata_api_check = true
  skip_requesting_account_id = true
  endpoints {
    ec2 = "http://localhost:4566"
    iam = "http://localhost:4566"
  }
}
EOF
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-096 — EC2 Instance Deployment Using Terraform

Create an aws_instance.nimbus with:
- ami = "ami-nimbus" (LocalStack accepts fake AMIs)
- instance_type = "t3.micro"
- tags Name=nimbus-ec2

Note: LocalStack EC2 is limited but create should succeed.
EOF
ok "Terraform an EC2 instance on LocalStack"
''')

w(SC / "devops/devops-096/verify.sh", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
ids=$(aws_local ec2 describe-instances --filters Name=tag:Name,Values=nimbus-ec2 --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || true)
[[ -n "$ids" && "$ids" != "None" ]] && ok "instance $ids" || { err "instance not found"; exit 1; }
''')

# ═══════════════════════════════════════════════════════════════════════════
# SadServers-style troubleshooting
# ═══════════════════════════════════════════════════════════════════════════

def sad(num: str, title: str, setup: str, verify: str, hints: str = "") -> None:
    base = SC / f"sadservers/sad-{num}"
    w(base / "setup.sh", setup)
    w(base / "verify.sh", verify)
    if hints:
        w(base / "HINTS.md", hints)

sad("001", "Broken Nginx", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  service nginx stop 2>/dev/null || true
  # break config
  mkdir -p /etc/nginx/sites-enabled /var/www/html
  echo "server { listen 80; root /var/www/html; }" > /etc/nginx/sites-enabled/default
  # intentional syntax error in a conf
  echo "server { listen 80 broken_directive; }" > /etc/nginx/conf.d/broken.conf
  echo "<h1>Nimbus Lab Site</h1>" > /var/www/html/index.html
  # disable main service
  rm -f /run/nginx.pid
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-001 — Broken Nginx

Nginx will not serve on port 80 inside the linux lab (mapped host :8081).
Find the config error, fix it, start nginx, ensure index is served.
EOF
ok "Nginx is broken — fix it"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# host port 8081 maps to container 80
body=$(curl -sf http://localhost:8081/ || docker exec grounds-linux-lab curl -sf http://127.0.0.1/ || true)
echo "$body" | grep -qi nimbus && ok "site served" || { err "not serving"; exit 1; }
''', "Check nginx -t inside the lab. Look at /etc/nginx/conf.d/broken.conf\n---\nRemove or fix broken.conf, then nginx or service nginx start\n")

sad("002", "Disk full", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  mkdir -p /var/practice/logs /var/practice/fill
  # create large junk files (not truly full disk — simulate)
  dd if=/dev/zero of=/var/practice/fill/junk1.bin bs=1M count=200 2>/dev/null
  dd if=/dev/zero of=/var/practice/fill/junk2.bin bs=1M count=200 2>/dev/null
  # "app" cannot write because directory is immutable-like via permissions
  touch /var/practice/logs/app.log
  chattr +i /var/practice/logs/app.log 2>/dev/null || chmod 000 /var/practice/logs
  echo "APP_LOG=/var/practice/logs/app.log" > /var/practice/app.env
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-002 — Disk full / cannot write logs

The app cannot write to /var/practice/logs/app.log.
Investigate (du, df, lsattr, permissions). Free the junk in /var/practice/fill
and make the log writable again. Write a line "recovered" to the log.
EOF
ok "Recover disk/log write path"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'echo recovered >> /var/practice/logs/app.log' \
  && ok "log writable" || { err "still cannot write log"; exit 1; }
docker exec grounds-linux-lab bash -c 'test ! -f /var/practice/fill/junk1.bin -o ! -f /var/practice/fill/junk2.bin' \
  && ok "junk cleaned (at least partially)" || warn "junk files still present — preferred to delete"
docker exec grounds-linux-lab grep -q recovered /var/practice/logs/app.log && ok "recovered marker"
''')

sad("003", "Permissions", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  useradd -m deploy 2>/dev/null || true
  mkdir -p /opt/nimbus
  echo "app" > /opt/nimbus/app.txt
  chown root:root /opt/nimbus /opt/nimbus/app.txt
  chmod 700 /opt/nimbus
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-003 — Permission denied on deploy path

User **deploy** must be able to write to /opt/nimbus (group-based least privilege preferred).
Prove by writing /opt/nimbus/deployed.ok as deploy.
EOF
ok "Fix deploy permissions"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'sudo -u deploy test -w /opt/nimbus && sudo -u deploy touch /opt/nimbus/deployed.ok' \
  && ok "deploy can write" || { err "deploy cannot write /opt/nimbus"; exit 1; }
''')

sad("004", "Cron", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  echo "#!/bin/bash" > /usr/local/bin/backup-nimbus.sh
  echo "date >> /var/practice/backup.log" >> /usr/local/bin/backup-nimbus.sh
  chmod 644 /usr/local/bin/backup-nimbus.sh   # not executable — bug
  echo "* * * * * root /usr/local/bin/backup-nimbus.sh" > /etc/cron.d/nimbus-backup
  # bad: missing newline sometimes matters; ensure cron runs
  service cron start 2>/dev/null || cron || true
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-004 — Cron job not firing

Backup cron is installed but never writes /var/practice/backup.log.
Find why and fix. Trigger once manually if needed to prove, and leave cron correct.
EOF
ok "Fix backup cron"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab test -x /usr/local/bin/backup-nimbus.sh && ok "script executable" || { err "script not executable"; exit 1; }
docker exec grounds-linux-lab bash /usr/local/bin/backup-nimbus.sh
docker exec grounds-linux-lab test -s /var/practice/backup.log && ok "log written" || { err "log empty"; exit 1; }
''')

sad("005", "SSH config", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
  # break: invalid directive and PermitRootLogin without care
  echo "PermitRootLogin no" >> /etc/ssh/sshd_config
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
  echo "BlargEnabled yes" >> /etc/ssh/sshd_config
  # keep current sshd running — student must fix config and validate with sshd -t
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-005 — Fix sshd_config

sshd_config has an invalid directive and overly strict settings for this lab.
1. Make `sshd -t` pass
2. Allow PasswordAuthentication yes for student user practice
3. Do not require BlargEnabled
Write fixed proof: output of sshd -t to sshd-t.txt in workspace (via docker exec).
EOF
ok "Fix sshd_config"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'sshd -t' && ok "sshd -t clean" || { err "sshd -t failed"; exit 1; }
docker exec grounds-linux-lab grep -q '^BlargEnabled' /etc/ssh/sshd_config && { err "invalid directive remains"; exit 1; } || ok "bad directive removed"
''')

sad("006", "Port conflict", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  # occupy port 8080 inside lab
  mkdir -p /var/practice
  nohup python3 -c "import http.server,socketserver; socketserver.TCPServer((\"0.0.0.0\",8080), http.server.SimpleHTTPRequestHandler).serve_forever()" >/tmp/blocker.log 2>&1 &
  echo $! > /var/practice/blocker.pid
  echo "#!/bin/bash" > /var/practice/start-api.sh
  echo "python3 -m http.server 8080 --bind 0.0.0.0" >> /var/practice/start-api.sh
  chmod +x /var/practice/start-api.sh
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-006 — Port conflict

start-api.sh cannot bind :8080. Find the process holding the port, stop it safely,
and leave a note of the culprit in culprit.txt (process name or pid story).
EOF
ok "Resolve port 8080 conflict in linux lab"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# port should be free OR our start script can bind
docker exec grounds-linux-lab bash -c '
  if ss -lntp | grep -q ":8080 "; then
    # if something listens, it should be start-api related after student fix — just ensure not the original blocker pid
    if [[ -f /var/practice/blocker.pid ]] && kill -0 $(cat /var/practice/blocker.pid) 2>/dev/null; then
      exit 1
    fi
  fi
  exit 0
' && ok "blocker cleared" || { err "blocker still holding 8080"; exit 1; }
''')

sad("007", "DNS in container", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-sad-dns 2>/dev/null || true
docker run -d --name grounds-sad-dns --dns 127.0.0.1 alpine:3.20 sleep infinity >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-007 — DNS resolution broken in container

Container grounds-sad-dns cannot resolve hostnames (bad --dns).
Fix it (recreate with good DNS or fix resolv.conf) so `nslookup example.com` or `ping -c1 example.com` works.
EOF
ok "Fix DNS for grounds-sad-dns"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-sad-dns ping -c1 -W2 example.com >/dev/null 2>&1 \
  || docker exec grounds-sad-dns nslookup example.com >/dev/null 2>&1 \
  || docker exec grounds-sad-dns wget -q -O- http://example.com >/dev/null 2>&1 \
  && ok "DNS works" || { err "still cannot resolve"; exit 1; }
''')

sad("008", "Postgres auth", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# Break nimbus db password via env mismatch simulation: create alternate role
docker exec grounds-nimbus-db psql -U nimbus -d nimbus -c "ALTER USER nimbus PASSWORD 'rotated-secret';" 2>/dev/null || true
# api still uses old password — will be degraded. Student must align secrets.
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-008 — Postgres auth failed

Nimbus API health shows postgres failing after a "secret rotation".
Either:
- set the DB password back to `nimbus`, OR
- update the API container env to the new password `rotated-secret` and recreate it

Health must return postgres ok again.
EOF
ok "Postgres auth broken for Nimbus — restore connectivity"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
# wait a moment
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:8080/health | jq -e '.checks.postgres=="ok"' >/dev/null 2>&1; then
    ok "postgres healthy"; exit 0
  fi
  sleep 2
done
err "postgres still failing health"; exit 1
''')

sad("009", "OOM", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  cat > /var/practice/memhog.py << "PY"
import time
data = []
for i in range(50):
    data.append("x" * (5 * 1024 * 1024))  # 5MB * 50
    time.sleep(0.05)
print("allocated", len(data))
time.sleep(3600)
PY
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-009 — Memory pressure

A memhog script exists at /var/practice/memhog.py in the lab.
1. Run it under a memory limit using `systemd-run` or Docker-style approach OR ulimit
2. Write a short NOTES.md explaining how you would protect a production worker (cgroup limits, requests/limits in K8s)
3. Ensure you can run: `ulimit -v` demonstration script `safe_run.sh` that fails gracefully
EOF
ok "Practice memory limits"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
[[ -f "$WORKSPACE/NOTES.md" ]] && ok "NOTES.md present" || { err "write NOTES.md"; exit 1; }
grep -qiE 'cgroup|limit|kubernetes|ulimit|oom' "$WORKSPACE/NOTES.md" && ok "notes mention limits" || { err "notes too thin"; exit 1; }
''')

sad("010", "TLS expired", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE" "${GROUNDS_ROOT}/app/nimbus/nginx/certs"
# create expired-like weak cert situation: empty then student creates
rm -f "${GROUNDS_ROOT}/app/nimbus/nginx/certs/fullchain.pem" "${GROUNDS_ROOT}/app/nimbus/nginx/certs/privkey.pem"
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-010 — TLS certificate

Generate a self-signed cert for local Nimbus nginx:
- app/nimbus/nginx/certs/fullchain.pem
- app/nimbus/nginx/certs/privkey.pem
CN=localhost, 825 days.

Optionally enable SSL server block and reload grounds-nimbus-nginx.
Save `openssl x509 -in fullchain.pem -noout -subject` to cert-subject.txt
EOF
ok "Issue local TLS cert for Nimbus"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cert="${GROUNDS_ROOT}/app/nimbus/nginx/certs/fullchain.pem"
key="${GROUNDS_ROOT}/app/nimbus/nginx/certs/privkey.pem"
[[ -f "$cert" && -f "$key" ]] && ok "cert files exist" || { err "cert/key missing"; exit 1; }
openssl x509 -in "$cert" -noout -text >/dev/null && ok "cert parseable" || { err "bad cert"; exit 1; }
''')

sad("011", "Firewall", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  iptables -F || true
  iptables -P INPUT DROP
  iptables -P FORWARD DROP
  iptables -P OUTPUT ACCEPT
  iptables -A INPUT -i lo -j ACCEPT
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT
  # forgot established, forgot 80
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-011 — Half-open firewall

iptables DROP policy broke web and established connections.
Restore safe rules allowing:
- lo
- established/related
- 22, 80, 443
Keep default policy reasonably secure.
EOF
ok "Fix iptables in linux lab"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
docker exec grounds-linux-lab bash -c 'iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -S INPUT | grep -q "dport 80"' \
  && ok "port 80 allowed" || { err "port 80 not allowed"; exit 1; }
''')

sad("012", "Docker restart loop", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker rm -f grounds-sad-loop 2>/dev/null || true
# bad command causes restart loop
docker run -d --name grounds-sad-loop --restart unless-stopped alpine:3.20 sh -c "echo boom; exit 1" >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-012 — Container restart loop

grounds-sad-loop is crash-looping. Diagnose with docker logs/inspect,
fix the root cause, and replace it with a healthy container of the same name
running `sleep infinity` or nginx.
EOF
ok "Fix restart loop container"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
state=$(docker inspect -f '{{.State.Running}}' grounds-sad-loop 2>/dev/null || echo false)
[[ "$state" == "true" ]] && ok "running" || { err "not running"; exit 1; }
restarts=$(docker inspect -f '{{.RestartCount}}' grounds-sad-loop)
# after fix restart count may be high but should be stable — check not exiting
sleep 2
state2=$(docker inspect -f '{{.State.Running}}' grounds-sad-loop)
[[ "$state2" == "true" ]] && ok "still running" || { err "still crashing"; exit 1; }
''')

sad("013", "K8s crashloop", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
kubectl --context kind-grounds delete pod crashy --ignore-not-found >/dev/null 2>&1 || true
cat <<'YAML' | kubectl --context kind-grounds apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: crashy
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo missing config; exit 1"]
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-013 — CrashLoopBackOff

Pod `crashy` is crash looping. Fix it so it becomes Running
(change command to sleep infinity or fix the process).
Document root cause in NOTES.md.
EOF
ok "Fix crashy pod"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
phase=$(kubectl --context kind-grounds get pod crashy -o jsonpath='{.status.phase}' 2>/dev/null || echo Missing)
[[ "$phase" == "Running" ]] && ok "Running" || { err "phase=$phase"; exit 1; }
''')

sad("014", "No endpoints", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
kubectl --context kind-grounds delete deploy web-backend svc web-backend --ignore-not-found >/dev/null 2>&1 || true
cat <<'YAML' | kubectl --context kind-grounds apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-backend
  template:
    metadata:
      labels:
        app: web-backend
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          ports: [{containerPort: 80}]
---
apiVersion: v1
kind: Service
metadata:
  name: web-backend
spec:
  selector:
    app: web-backend-typo
  ports:
    - port: 80
      targetPort: 80
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-014 — Service has no endpoints

Service web-backend selects the wrong labels. Fix selector so endpoints populate.
EOF
ok "Fix service selector"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
eps=$(kubectl --context kind-grounds get endpoints web-backend -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)
[[ -n "$eps" ]] && ok "endpoints: $eps" || { err "no endpoints"; exit 1; }
''')

sad("015", "Time drift", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-015 — Time drift breaks JWT auth

Simulate investigation:
1. In linux lab, inspect `date -u` and compare to host
2. Write NOTES.md explaining NTP/chrony and how skew breaks JWT exp/nbf
3. Write a small python script `check_skew.py` that exits 1 if skew > 30s vs an API date header (use example.com or local)

This is a research+scripting lab rather than forcing container time change (needs privileges).
EOF
ok "Document and script time-skew checks"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
[[ -f "$WORKSPACE/NOTES.md" ]] && grep -qiE 'jwt|ntp|chrony|skew' "$WORKSPACE/NOTES.md" && ok "notes ok" || { err "NOTES.md incomplete"; exit 1; }
[[ -f "$WORKSPACE/check_skew.py" ]] && ok "script present" || { err "check_skew.py missing"; exit 1; }
''')

sad("016", "SQS lag", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
mkdir -p "$WORKSPACE"
aws_local sqs create-queue --queue-name nimbus-jobs >/dev/null 2>&1 || true
url=$(aws_local sqs get-queue-url --queue-name nimbus-jobs --query QueueUrl --output text)
for i in 1 2 3 4 5; do
  aws_local sqs send-message --queue-url "$url" --message-body "{\"job\":$i}" >/dev/null
done
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-016 — SQS consumer lag

Queue nimbus-jobs has messages. Drain them (receive+delete) until approximate count is 0.
Save final attributes to queue-attrs.json.
Optionally fix worker env SQS_QUEUE_URL if using Nimbus worker.
EOF
echo "$url" >"$WORKSPACE/queue-url.txt"
ok "Drain nimbus-jobs queue"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
url=$(aws_local sqs get-queue-url --queue-name nimbus-jobs --query QueueUrl --output text)
count=$(aws_local sqs get-queue-attributes --queue-url "$url" --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)
[[ "${count:-1}" == "0" ]] && ok "queue drained" || { err "still $count messages"; exit 1; }
''')

sad("017", "S3 access denied", r'''
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
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
attached=$(aws_local iam list-attached-user-policies --user-name nimbus-app --query 'AttachedPolicies[].PolicyName' --output text 2>/dev/null || true)
inline=$(aws_local iam list-user-policies --user-name nimbus-app --query 'PolicyNames' --output text 2>/dev/null || true)
if [[ -n "$attached" || -n "$inline" ]]; then ok "user has policy ($attached $inline)"; else err "no policy on nimbus-app"; exit 1; fi
''')

sad("018", "LB health", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# break nginx upstream health path in a local proxy config student can fix
cat >"$WORKSPACE/nginx-lb.conf" <<'EOF'
upstream api {
  server host.docker.internal:8080;
}
server {
  listen 80;
  location /healthz {
    proxy_pass http://api/health-wrong;
  }
  location / {
    proxy_pass http://api/;
  }
}
EOF
docker rm -f grounds-sad-lb 2>/dev/null || true
docker run -d --name grounds-sad-lb -p 18085:80 \
  -v "$WORKSPACE/nginx-lb.conf:/etc/nginx/conf.d/default.conf:ro" \
  --add-host=host.docker.internal:host-gateway \
  nginx:1.27-alpine >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-018 — Load balancer health checks failing

grounds-sad-lb proxies to Nimbus but /healthz is wrong.
Fix nginx-lb.conf so /healthz returns 200 from the real /health endpoint,
then reload/recreate the container.
EOF
ok "Fix LB health check path"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:18085/healthz || echo 000)
[[ "$code" == "200" ]] && ok "healthz 200" || { err "healthz returned $code"; exit 1; }
''')

sad("019", "Detached HEAD", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE/deploy-repo"
cd "$WORKSPACE/deploy-repo"
git init -b main >/dev/null
git config user.email student@grounds.local
git config user.name Student
echo v1 > version.txt
git add version.txt && git commit -m v1 >/dev/null
echo v2 > version.txt
git add version.txt && git commit -m v2 >/dev/null
# detach
git checkout HEAD~1 >/dev/null
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-019 — Git detached HEAD on deploy server

deploy-repo is in detached HEAD. Return to main branch tracking latest.
EOF
ok "Fix detached HEAD"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
cd "$WORKSPACE/deploy-repo"
branch=$(git branch --show-current)
[[ "$branch" == "main" || "$branch" == "master" ]] && ok "on $branch" || { err "still detached or wrong branch ($branch)"; exit 1; }
''')

sad("020", "Ansible unreachable", r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/inventory.ini" <<'INV'
[app]
grounds-app01 ansible_connection=docker ansible_python_interpreter=/usr/bin/python3
grounds-app02 ansible_connection=ssh ansible_host=127.0.0.1 ansible_port=22 ansible_user=nobody
grounds-missing ansible_connection=docker
INV
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-020 — Ansible unreachable hosts

inventory.ini has broken entries. Fix it so `ansible -i inventory.ini app -m ping`
succeeds for app01 and app02 (docker connection to grounds-app01/02).
Remove bogus hosts.
EOF
ok "Fix ansible inventory reachability"
''', r'''
#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
inv="$WORKSPACE/inventory.ini"
out=$(ansible -i "$inv" app -m ping 2>/dev/null || true)
pongs=$(echo "$out" | grep -c '"ping": "pong"' || true)
[[ "${pongs:-0}" -ge 2 ]] && ok "app group reachable ($pongs)" || { err "ping failed ($pongs pongs)"; exit 1; }
''')

print("Implemented scenarios written under", SC)
print("AWS+DevOps+SadServers scripts ready")
