# ACME Shop (`Test_Project`)

Realistic local project used to demonstrate **VERITAS on a real codebase**.

This is not dummy data baked into VERITAS. VERITAS starts **empty**. This project:

1. Runs a real HTTP service (`shop-api`)
2. Registers its topology with VERITAS
3. Ships live metrics, logs, and traces
4. Can raise a live incident from real traffic

## Stack

| Piece | Detail |
| --- | --- |
| Runtime | Node 20+ (no npm deps) |
| **Shop UI** | **http://127.0.0.1:8090/** |
| Service | `shop-api` on `:8090` |
| Routes | catalog, checkout, orders, health, metrics, stats |
| VERITAS bridge | `veritas/*.js` |

## Shop webpage

```bash
cd ./Test_Project && npm start
# open http://127.0.0.1:8090/
```

Browse catalog → add to cart → checkout. Live KPIs update from real API stats (same traffic VERITAS ships).

## Topology registered with VERITAS

```
shop-api
  ├── calls → payment-stub
  ├── uses  → orders-local
  ├── uses  → session-local
  ├── runs_on → local-dev
  └── produced_by → Test_Project repo
```

## Quick start (full demo)

```bash
# Terminal A · one shot orchestrator
chmod +x ./Test_Project/scripts/run-with-veritas.sh
./Test_Project/scripts/run-with-veritas.sh

# Terminal B · UI
cd ./ui && npm run dev
# → http://127.0.0.1:5173
```

## Manual steps

```bash
# 1. VERITAS (empty)
cd .
export VERITAS_DATA_DIR=~/.veritas/data-live
rm -f "$VERITAS_DATA_DIR"/veritas.duckdb*
cargo run -p veritas-api

# 2. Shop
cd ./Test_Project && npm start

# 3. Register + ship
npm run veritas:register
npm run veritas:ship          # continuous
# optional incident:
npm run veritas:demo
```

## Env

| Variable | Default |
| --- | --- |
| `VERITAS_URL` | `http://127.0.0.1:7420` |
| `SHOP_URL` | `http://127.0.0.1:8090` |
| `PORT` | `8090` |
| `SHIP_INTERVAL_MS` | `5000` |

## What you should see in VERITAS

- **Entities / Graph** · shop-api and dependencies
- **Telemetry** · rising request counts, p99, error rate, logs, spans
- **What Changed** · local deploy event on register
- **Why / Intel** · after `veritas:demo`, live incident from real p99
- **Analytics** · DuckDB rows from shipped metrics (not seed history)
