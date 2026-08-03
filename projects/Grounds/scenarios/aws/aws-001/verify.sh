#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
export_localstack_env
fail=0
if [[ ! -f "$WORKSPACE/nimbus-key.pem" ]]; then err "missing $WORKSPACE/nimbus-key.pem"; fail=1; fi
if [[ -f "$WORKSPACE/nimbus-key.pem" ]]; then
  mode=$(stat -c '%a' "$WORKSPACE/nimbus-key.pem" 2>/dev/null || stat -f '%A' "$WORKSPACE/nimbus-key.pem")
  if [[ "$mode" != "400" && "$mode" != "600" ]]; then warn "pem mode is $mode (prefer 400)"; fi
fi
names=$(aws_local ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output text 2>/dev/null || true)
if echo "$names" | tr '\t' '\n' | grep -qx 'nimbus-key'; then
  ok "key pair nimbus-key exists in LocalStack"
else
  err "key pair nimbus-key not found (got: $names)"; fail=1
fi
exit $fail
