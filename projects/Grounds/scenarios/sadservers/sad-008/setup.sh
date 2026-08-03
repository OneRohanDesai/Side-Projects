#!/usr/bin/env bash
set -euo pipefail
source "${GROUNDS_ROOT}/lib/common.sh"
mkdir -p "$WORKSPACE"
# Break nimbus db password via env mismatch simulation: create alternate role
docker exec grounds-nimbus-db psql -U nimbus -d nimbus -c "ALTER USER nimbus PASSWORD 'rotated-secret';" 2>/dev/null || true
# api still uses old password — will be degraded. Student must align secrets.
cat >"$WORKSPACE/README.md" <<'EOF'
# sad-008 — Postgres auth failed

Nimbus API health shows postgres failing after a "secret rotation".
Either:
- set the DB password back to `nimbus`, OR
- update the API container env to the new password `rotated-secret` and recreate it

Health must return postgres ok again.
EOF
ok "Postgres auth broken for Nimbus — restore connectivity"
