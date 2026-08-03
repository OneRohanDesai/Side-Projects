#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
kubectl --context kind-grounds delete pod crashy --ignore-not-found >/dev/null 2>&1 || true
cat <<'YAML' | kubectl --context kind-grounds apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: crashy
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo missing config; exit 1"]
YAML
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-013 — CrashLoopBackOff

Pod `crashy` is crash looping. Fix it so it becomes Running
(change command to sleep infinity or fix the process).
Document root cause in NOTES.md.
EOF
ok "Fix crashy pod"
