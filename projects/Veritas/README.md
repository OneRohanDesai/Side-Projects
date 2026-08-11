# VERITAS

```
██╗   ██╗███████╗██████╗ ██╗████████╗ █████╗ ███████╗
██║   ██║██╔════╝██╔══██╗██║╚══██╔══╝██╔══██╗██╔════╝
██║   ██║█████╗  ██████╔╝██║   ██║   ███████║███████╗
╚██╗ ██╔╝██╔══╝  ██╔══██╗██║   ██║   ██╔══██║╚════██║
 ╚████╔╝ ███████╗██║  ██║██║   ██║   ██║  ██║███████║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
```

**Vis Explorationis Rerum Intelligentia Technica Analytica Systematica**

> The power of exploring systems through systematic technical analytical intelligence.

---

## License · free for any use

This project is released under the **MIT License** (see [`LICENSE`](LICENSE)).

**You may use it, copy it, modify it, sell it, rebrand it, host it, or do whatever you want.**  
No royalties. No permission needed. No commercial restrictions.

This is a small AI-assisted side project exploring a local-first engineering intelligence workflow. It is **not** a product launch, SaaS, or production support offering.

---

## What it is

A **local-first engineering intelligence platform**: ingest telemetry and project topology, build a system graph, then answer **what changed**, **why**, **what's next**, and **what to do**.

Not “another Grafana.” Observability tools are inputs; **decisions** are the product.

**Production default: empty.** No dummy systems. Connect a real project (see `Test_Project/`).

---

## Quick start

### Prerequisites
- Rust (stable)
- Node 20+
- Go optional (agent)

### Control plane

```bash
cd Veritas
cargo run -p veritas-api
# → http://127.0.0.1:7420
```

### Console UI

```bash
cd Veritas/ui
npm install
npm run dev
# → http://127.0.0.1:5173
```

### Demo project (ACME Shop)

Included at [`Test_Project/`](Test_Project/) so anyone can try the end-to-end path:

```bash
# Shop UI + API
cd Test_Project && npm start
# → http://127.0.0.1:8090/

# Register topology + ship live metrics into VERITAS
npm run veritas:register
npm run veritas:ship
# optional incident from real traffic:
npm run veritas:demo
```

Or one orchestrator:

```bash
./Test_Project/scripts/run-with-veritas.sh
```

---

## Repository layout

```
Veritas/
├── crates/           # Rust workspace (api, intelligence, analytics, graph, …)
├── ui/               # Rose Petal console (frozen design)
├── Test_Project/     # ACME Shop sample app for local demos
├── agents/           # Go fleet agent
├── desktop/          # Tauri scaffold (optional)
├── docs/             # Architecture & phase notes
└── LICENSE           # MIT
```

---

## Design

**Rose Petal** palette · sharp corners only · help `?` for depth.  
See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) (frozen).

---

## Status

Phases 0–7 implemented as a complete local prototype:

- Telemetry ingest (OTel / Prometheus JSON)
- DuckDB analytics + SQL
- System graph + blast radius
- Intelligence products + AI explanation layer
- Enterprise stubs (auth, RBAC, audit, fleet, HA, packs, offline license)
- Empty production boot + `Test_Project` live demo path

Not production-hardened. Use as inspiration, fork food, or a weekend sandbox.

---

<p align="center">
  <strong>Observability tells you what happened.</strong><br/>
  <em>VERITAS explores why, what changed, what's next, and what to do.</em>
</p>
