#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
cat >"$WORKSPACE/README.md" <<'EOF'
# devops-010 — Bash Scripting Fundamentals

Write `count_orders.sh` in this workspace that:
1. Accepts a CSV path as $1 (sample: sample.csv)
2. Skips the header line
3. Prints the number of data rows
4. Exits 2 if file missing

Sample CSV is provided as sample.csv
EOF
cat >"$WORKSPACE/sample.csv" <<'CSV'
id,customer,total
1,alice,10
2,bob,20
3,carol,30
CSV
ok "Write count_orders.sh"
