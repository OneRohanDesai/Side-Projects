# Suggested learning path

Work top-down. Prefer **implemented** scenarios first (`jq -r '.scenarios[]|select(.implemented)|.id' scenarios/catalog.json`).

## Week 1 — Linux & scripting
| ID | Topic |
|----|--------|
| devops-001 | Users (nologin) |
| devops-002 | Expiring users |
| devops-004 | Permissions |
| devops-006 | Cron |
| devops-010 | Bash fundamentals |
| sad-001 | Broken Nginx |
| sad-002 | Disk / log write |
| sad-003 | Deploy permissions |
| sad-004 | Cron not firing |

## Week 2 — Git
| ID | Topic |
|----|--------|
| devops-021 | Bare repo + push |
| devops-024 | Branches |
| devops-025 | Merge |
| devops-033 | Conflicts |
| sad-019 | Detached HEAD |

## Week 3 — Docker
| ID | Topic |
|----|--------|
| devops-035 | Docker service + container |
| devops-036 | Nginx container |
| devops-041 | Dockerfile |
| devops-044 | Compose |
| devops-046 | Deploy Nimbus + order |
| sad-007 | DNS in container |
| sad-012 | Restart loop |

## Week 4 — AWS on LocalStack
| ID | Topic |
|----|--------|
| aws-001 | Key pairs |
| aws-002 | Security groups |
| aws-004 | S3 versioning |
| aws-016 / 018 | IAM user + policy |
| aws-023 | S3 migration |
| aws-033 | Lambda |
| aws-039 | Static website |
| aws-042 | DynamoDB |
| aws-046 | S3 → Lambda |
| aws-047 | SNS + SQS |
| aws-048 | CloudFormation |
| devops-094–096 | Terraform VPC/SG/EC2 |
| sad-016 / 017 | SQS lag / S3 IAM |

## Week 5 — Kubernetes (Kind)
| ID | Topic |
|----|--------|
| devops-048 | Pod |
| devops-049 | Deployment + scale |
| devops-050 | Resource limits |
| devops-062 | Secrets |
| sad-013 | CrashLoopBackOff |
| sad-014 | No endpoints |

## Week 6 — Ansible, Jenkins, harder AWS
- Ansible: devops-082, 086 + sad-020
- Jenkins stack: `grounds infra up jenkins` → devops-068+
- Scaffolded AWS networking / RDS / EKS-style: aws-027+

## Daily loop
```bash
eval "$(grounds env)"
grounds list devops
grounds start <id>
# work in state/workspaces/<id> or grounds shell
grounds verify
grounds stop
```
