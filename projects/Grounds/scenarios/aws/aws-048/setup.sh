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
