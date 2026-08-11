# VERITAS Architecture

## Process boundaries

Do **not** ship as one giant process. Isolate for crash containment, upgrades, and security.

```
VERITAS
│
├── Desktop / Web UI          (React · later Tauri shell)
│
├── Control Plane (Rust)      veritas-api
│     auth · config · plugins · license gate · API surface
│
├── Intelligence Engine       veritas-intelligence
│     What Changed · Why · Forecast · Archaeology · Reports
│
├── Analytics Engine          (DuckDB path; ClickHouse optional)
│     SQL · aggregation · stats · forecasting primitives
│
├── Storage Engine            veritas-storage
│     hot (columnar) · historical (Parquet) · raw archive
│
├── License Agent             veritas-license
│     entitlement verify · machine binding · offline licenses
│
├── Telemetry Gateway
│     OTel · Prometheus · normalize · enrich
│
└── Agents (Go/Rust)
      eBPF · host · k8s · docker · plugin collectors
```

Phase 1 collapses gateway + analytics into the control plane with **in-memory sample fabric**. Boundaries remain in crate layout.

## Data flow

```
 Environment
     │
     ▼
 Ingestion (OTel / Prom / eBPF / APIs / Git / Cloud)
     │
     ▼
 Normalizer (Arrow schemas · entity enrichment)
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
  Hot store     Historical      Raw archive
  (ClickHouse/  (Parquet)       (object/fs)
   DuckDB)
     │              │
     └──────┬───────┘
            ▼
     Analytics Engine
            ▼
   System Intelligence Graph
            ▼
   Fact Extraction → Reasoning
            ▼
   WHAT / WHY / NEXT / DO
            ▼
   UI · Reports · Actions · Optional AI explanation
```

## API surface (Phase 1)

Base URL: `http://127.0.0.1:7420`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/v1/system/overview` | Health + summary KPIs |
| GET | `/v1/entities` | List entities |
| GET | `/v1/entities/:id` | Entity detail + intelligence card |
| GET | `/v1/graph` | Topology edges |
| GET | `/v1/intelligence/what-changed?window=` | Signature feature |
| GET | `/v1/intelligence/why?entity=` | Why engine |
| GET | `/v1/intelligence/forecast` | Capacity / risk forecast |
| GET | `/v1/intelligence/archaeology?entity=` | Slow degradation |
| GET | `/v1/intelligence/actions` | Compressed recommendations |
| GET | `/v1/reports/daily` | Autonomous daily report |
| GET | `/v1/incidents` | Active / sample incidents |
| GET | `/v1/license` | Current entitlements |
| GET | `/v1/plugins` | Registered plugins |

## IPC evolution
- **Phase 1:** HTTP + JSON (simple, debuggable, CORS for Vite)
- **Phase 2+:** gRPC / Unix sockets for agent ↔ plane; HTTP remains for UI

## Storage tiers

| Tier | Tech | Role |
| --- | --- | --- |
| Hot | DuckDB (local) / ClickHouse (scale) | Interactive analytics |
| Warm | Parquet on disk | Retention, archaeology |
| Graph | Relational tables first | Entities + edges (no graph DB yet) |
| Raw | Filesystem / object | Replay, forensics |
| Interchange | Apache Arrow | Zero-copy analytical transport |

## AI placement

```
SYSTEM DATA → ANALYTICS → FACTS → SYSTEM KNOWLEDGE
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                  deterministic ML/stats    optional LLM
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                              REASONING / UX
```

LLM never owns truth. Facts are computed; language models narrate and assist.

## Security boundaries
- Control plane binds localhost by default
- Agents authenticate to plane (mTLS planned)
- License private key never ships
- Binary integrity + signed updates (Sigstore-class) for release
- Air-gap mode: offline license + no outbound calls

## Deployment shapes
1. **Developer laptop** — single binary API + UI
2. **SRE workstation appliance** — full local lakehouse
3. **Edge / single cluster** — agent + plane co-located
4. **Enterprise air-gap** — offline license, fleet agents, SSO
