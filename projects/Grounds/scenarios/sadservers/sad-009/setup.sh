#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
docker exec grounds-linux-lab bash -c '
  cat > /var/practice/memhog.py << "PY"
import time
data = []
for i in range(50):
    data.append("x" * (5 * 1024 * 1024))  # 5MB * 50
    time.sleep(0.05)
print("allocated", len(data))
time.sleep(3600)
PY
'
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-009 — Memory pressure

A memhog script exists at /var/practice/memhog.py in the lab.
1. Run it under a memory limit using `systemd-run` or Docker-style approach OR ulimit
2. Write a short NOTES.md explaining how you would protect a production worker (cgroup limits, requests/limits in K8s)
3. Ensure you can run: `ulimit -v` demonstration script `safe_run.sh` that fails gracefully
EOF
ok "Practice memory limits"
