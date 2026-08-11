# Security Model

## Trust goals
1. Customer data never leaves the environment unless explicitly configured
2. Product works air-gapped
3. Agents and plugins are least-privilege
4. License and update channels are cryptographically authentic
5. Multi-user deployments support RBAC + audit

## Threat categories

| Threat | Mitigation |
| --- | --- |
| Telemetry exfiltration | Local-first default; no cloud AI required |
| License forgery | Asymmetric certs; public key only in binary |
| Plugin supply chain | Signed packs; capability allowlists |
| Compromised agent | mTLS to plane; scoped tokens (planned) |
| Privilege escalation via UI | Local auth + future OIDC/RBAC |
| Tampered updates | Signed artifacts + integrity checks |

## AuthN / AuthZ roadmap
- Phase 1: open local API (dev), license edition gates features
- Phase 2: local user accounts
- Phase 3: OIDC/LDAP SSO, RBAC roles, audit log
- Enterprise: session policies, seat enforcement

## Data protection
- Encryption at rest for sensitive config (planned)
- TLS for non-localhost binds
- Secrets never in sample data commits
- Optional TPM for device identity

## eBPF note
eBPF collectors require elevated privileges. Isolate agent process; document capability requirements; never run UI as root.
