#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f data/thetable.db data/thetable.db-wal data/thetable.db-shm
echo "Database wiped. Next start will reseed."
