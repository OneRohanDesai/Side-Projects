#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-015 — Time drift breaks JWT auth

Simulate investigation:
1. In linux lab, inspect `date -u` and compare to host
2. Write NOTES.md explaining NTP/chrony and how skew breaks JWT exp/nbf
3. Write a small python script `check_skew.py` that exits 1 if skew > 30s vs an API date header (use example.com or local)

This is a research+scripting lab rather than forcing container time change (needs privileges).
EOF
ok "Document and script time-skew checks"
