#!/usr/bin/env bash
# Launch VERITAS control plane + UI for local demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "◆ VERITAS · starting control plane on :7420"
cargo build -p veritas-api --quiet
cargo run -p veritas-api &
API_PID=$!

cleanup() {
  echo "◆ shutting down control plane (pid $API_PID)"
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for health
for i in {1..40}; do
  if curl -sf http://127.0.0.1:7420/health >/dev/null 2>&1; then
    echo "◆ control plane ready"
    break
  fi
  sleep 0.25
done

echo "◆ VERITAS · starting UI on :5173"
cd "$ROOT/ui"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm run dev -- --host 127.0.0.1 --port 5173
