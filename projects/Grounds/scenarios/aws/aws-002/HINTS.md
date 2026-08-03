# Hints
Create default VPC SG then authorize ingress.
---
aws --endpoint-url=http://localhost:4566 ec2 create-security-group --group-name nimbus-web-sg --description 'Nimbus web tier'
aws --endpoint-url=http://localhost:4566 ec2 authorize-security-group-ingress --group-name nimbus-web-sg --protocol tcp --port 80 --cidr 0.0.0.0/0
# repeat for 443 and 22 (10.0.0.0/8)
