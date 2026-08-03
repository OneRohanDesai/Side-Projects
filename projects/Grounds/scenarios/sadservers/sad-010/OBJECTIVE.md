# TLS certificate expired

**Track:** sadservers  
**Difficulty:** medium  
**Skills:** nginx, tls  
**Infra:** nimbus, linux

## Goal

Nginx serves expired self-signed cert. Issue a new local cert and reload safely.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-010/`
- `grounds verify` passes
