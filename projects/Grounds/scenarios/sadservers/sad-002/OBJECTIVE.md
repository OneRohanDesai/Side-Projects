# Disk full — can't write logs

**Track:** sadservers  
**Difficulty:** easy  
**Skills:** linux, disk, debug  
**Infra:** linux

## Goal

Application can't write logs because the disk is full (or inode exhaustion). Free space without deleting critical data.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-002/`
- `grounds verify` passes
