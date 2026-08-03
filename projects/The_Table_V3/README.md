# The Table v3

**Zero-internet restaurant operations OS** for a private Wi‑Fi LAN.

Not a simulator. Every action is a real staff step on a real tablet:

```
Floor seats guests → Waiter takes order → Expeditor fires tickets
      → Stations cook with timers → QC pass → Waiter runs food → Bill / clear
```

## Quick start

```bash
cd ~/The_Table_V3
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open on any device on the same network:

| Role | URL |
|------|-----|
| Hub | `http://YOUR_IP:8000/` |
| Floor Manager | `/floor` |
| Waiter | `/waiter` |
| Expeditor (Head Chef) | `/expeditor` |
| Kitchen station | `/station?station=grill` |
| Executive | `/executive` |
| Simulation (opt-in) | `/simulation` |

Stations: `grill` · `saute` · `sauce` · `fry` · `cold` · `pastry` · `beverage`

### Simulation

Off by default. Open `/simulation` and click **Run the simulation** for medium-pace full service (seat → order → fire → cook → QC → deliver → clear). It calls the **same APIs** as staff, so Floor / Waiter / Expeditor / Station / Executive all update live. Click **Stop** to freeze.

### Docker

```bash
docker compose up -d --build
```

Data lives in `./data/thetable.db` (SQLite, WAL mode) and survives restarts.

## How service works

1. **Floor** — double-tap vacant table → seat party size.
2. **Waiter** — pick yourself → *New order* → select occupied table → tap dishes → Send.
3. **Expeditor** — *To kitchen* fires prep steps as station tickets (priority / refire / cancel).
4. **Station** — Start timer → Done. When all tickets complete, order becomes **ready**.
5. **Expeditor** — **QC pass** → waiters see **ready for pickup**.
6. **Waiter** — Pickup → Delivered. Optional refire request.
7. **Floor** — Clear table → dirty → Mark clean when bussed.

## API

- `GET /api/health` — liveness
- `GET /api/state` — full snapshot
- `GET /api/tables` · `POST /api/tables/{id}/seat|clear|clean`
- `GET|POST /api/menu` · toggle 86 · delete
- `GET|POST /api/orders` · fire · priority · qc · pickup · deliver · cancel · refire
- `GET /api/tickets` · start · complete
- `GET /api/analytics`
- `WS /ws` — live events (`snapshot`, `orders_updated`, `tables_updated`, …)

Interactive docs: `http://YOUR_IP:8000/docs`

## Seed data

On first boot:

- 50 tables (patio / main / bar / private)
- 16-dish menu with multi-station prep steps
- 15 waiters with section assignments
- 7 station leads + expeditor / executive / manager

To wipe and reseed:

```bash
rm -f data/thetable.db
python server.py
```

## Kubernetes (optional)

```bash
docker build -t the-table:latest .
kubectl apply -f k8s/
```

Service: NodePort `30080`. Single replica + PVC (SQLite is not multi-writer).

## Design principles

- **LAN only** — no cloud dependency
- **Staff-driven** — no auto-cooking simulation
- **SQLite** — durable, portable, one file
- **WebSocket** — every tablet stays in sync
- **Tablet-first** — large targets, dark kitchen UI, sounds on new tickets

## Project layout

```
app/                 FastAPI app, domain services, seed
frontend/            Role UIs + static assets
data/                SQLite + optional legacy JSON
k8s/                 Namespace, PVC, Deployment, Service
docker-compose.yml
server.py            uvicorn entrypoint
```

Built for restaurants that never sleep.
