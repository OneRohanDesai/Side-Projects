# DNS resolution broken in container

**Track:** sadservers  
**Difficulty:** medium  
**Skills:** docker, dns, debug  
**Infra:** docker, nimbus

## Goal

Container can't resolve external hostnames. Fix resolv.conf / Docker DNS.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-007/`
- `grounds verify` passes
