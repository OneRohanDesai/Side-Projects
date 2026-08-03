# Practice2 — SadServers-style troubleshooting

Source inspiration: [sadservers.com](https://sadservers.com) — Linux / DevOps / SRE interview labs.

In **Grounds** these are track `sadservers` (`sad-001` … `sad-020`):

| ID | Lab |
|----|-----|
| sad-001 | Broken Nginx |
| sad-002 | Disk full / can't write logs |
| sad-003 | Permission denied on deploy path |
| sad-004 | Cron job not firing |
| sad-005 | SSH config broken |
| sad-006 | Port conflict |
| sad-007 | DNS broken in container |
| sad-008 | Postgres auth failed (Nimbus) |
| sad-009 | Memory pressure / OOM thinking |
| sad-010 | TLS certificate |
| sad-011 | Half-open firewall |
| sad-012 | Docker restart loop |
| sad-013 | K8s CrashLoopBackOff |
| sad-014 | K8s service no endpoints |
| sad-015 | Time drift / JWT |
| sad-016 | SQS consumer lag (LocalStack) |
| sad-017 | S3 access denied (IAM) |
| sad-018 | Load balancer health checks |
| sad-019 | Git detached HEAD |
| sad-020 | Ansible unreachable hosts |

```bash
grounds list sadservers
grounds start sad-001
```
