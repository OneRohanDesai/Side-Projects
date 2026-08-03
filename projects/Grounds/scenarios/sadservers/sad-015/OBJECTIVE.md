# Time drift breaks JWT auth

**Track:** sadservers  
**Difficulty:** hard  
**Skills:** linux, time, security  
**Infra:** linux, nimbus

## Goal

Auth tokens invalid due to clock skew in the lab container. Fix time sync.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-015/`
- `grounds verify` passes
