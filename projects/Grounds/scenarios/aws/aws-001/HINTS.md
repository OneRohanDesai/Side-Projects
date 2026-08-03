# Hints aws-001
Use LocalStack endpoint http://localhost:4566 with dummy credentials test/test.
---
aws --endpoint-url=http://localhost:4566 ec2 create-key-pair --key-name nimbus-key --query KeyMaterial --output text > nimbus-key.pem && chmod 400 nimbus-key.pem
---
Verify with: aws --endpoint-url=http://localhost:4566 ec2 describe-key-pairs
