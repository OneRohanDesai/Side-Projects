#!/usr/bin/env bash
# Full demo: VERITAS (empty) + ACME Shop + live registration + shipping
set -euo pipefail

ROOT_TEST="$(cd "$(dirname "$0")/.." && pwd)"
# When Test_Project lives inside the VERITAS repo: .../Veritas/Test_Project
VERITAS_DIR="${VERITAS_DIR:-$(cd "$ROOT_TEST/.." && pwd)}"
export VERITAS_URL="${VERITAS_URL:-http://127.0.0.1:7420}"
export SHOP_URL="${SHOP_URL:-http://127.0.0.1:8090}"
export VERITAS_DATA_DIR="${VERITAS_DATA_DIR:-$HOME/.veritas/data-live}"

echo "◆ ACME Shop + VERITAS live demo"
echo "  VERITAS_DIR=$VERITAS_DIR"
echo "  VERITAS_URL=$VERITAS_URL"
echo "  SHOP_URL=$SHOP_URL"
echo "  data dir (fresh): $VERITAS_DATA_DIR"

# Fresh analytics DB so no leftover demo history
mkdir -p "$VERITAS_DATA_DIR"
rm -f "$VERITAS_DATA_DIR/veritas.duckdb" "$VERITAS_DATA_DIR/veritas.duckdb.wal" 2>/dev/null || true

cleanup() {
  echo "◆ shutting down..."
  [[ -n "${SHOP_PID:-}" ]] && kill "$SHOP_PID" 2>/dev/null || true
  [[ -n "${SHIP_PID:-}" ]] && kill "$SHIP_PID" 2>/dev/null || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Free ports if needed
fuser -k 7420/tcp 2>/dev/null || true
fuser -k 8090/tcp 2>/dev/null || true
sleep 0.3

echo "◆ Starting VERITAS control plane (empty production state)"
(
  cd "$VERITAS_DIR"
  cargo run -q -p veritas-api
) &
API_PID=$!

for i in $(seq 1 60); do
  if curl -sf "$VERITAS_URL/health" >/dev/null; then
    echo "◆ VERITAS ready"
    break
  fi
  sleep 0.5
done

echo "◆ Starting ACME Shop API"
node "$ROOT_TEST/src/server.js" &
SHOP_PID=$!
sleep 0.5
curl -sf "$SHOP_URL/health" >/dev/null
echo "◆ Shop ready"

echo "◆ Registering project topology"
node "$ROOT_TEST/veritas/register.js"

echo "◆ Shipping live metrics (background)"
node "$ROOT_TEST/veritas/ship.js" &
SHIP_PID=$!

sleep 6
echo "◆ Raising a live incident from shop traffic"
node "$ROOT_TEST/veritas/demo-incident.js"

echo ""
echo "◆ Live demo running"
echo "  Shop:     $SHOP_URL"
echo "  VERITAS:  $VERITAS_URL"
echo "  UI:       cd $VERITAS_DIR/ui && npm run dev"
echo "  Overview: curl -s $VERITAS_URL/v1/system/overview | jq"
echo "  Entities: curl -s $VERITAS_URL/v1/entities | jq"
echo "  Why:      curl -s $VERITAS_URL/v1/intelligence/why | jq"
echo ""
echo "Press Ctrl+C to stop."

wait
