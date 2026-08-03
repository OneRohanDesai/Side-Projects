# SSH lockout risk — fix sshd_config

**Track:** sadservers  
**Difficulty:** medium  
**Skills:** linux, ssh, security  
**Infra:** linux

## Goal

sshd is misconfigured (bad PermitRootLogin / PasswordAuthentication / AllowUsers). Fix without locking yourself out.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-005/`
- `grounds verify` passes
