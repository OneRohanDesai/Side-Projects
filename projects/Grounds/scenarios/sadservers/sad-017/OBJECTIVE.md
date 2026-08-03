# S3 access denied after IAM change

**Track:** sadservers  
**Difficulty:** medium  
**Skills:** s3, iam, debug  
**Infra:** localstack, nimbus

## Goal

App lost S3 access after policy edit. Restore least-privilege access.

## Success criteria

- You can demonstrate the end state with CLI output or running services
- Solution artifacts live in `state/workspaces/sad-017/`
- `grounds verify` passes
