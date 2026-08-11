# Phase Plan

## Phase 0 · Architecture ✅
Entity, telemetry, data, plugin, license, security, UI models, API contracts, sample policy.

## Phase 1 · Local platform shell ✅
Linux monorepo, Rust control plane, React console, license stub, sample system, demo incident.

## Phase 2 · Telemetry ✅
OpenTelemetry HTTP JSON, Prometheus JSON ingest, metrics/logs/traces fabric, discovery scan.

## Phase 3 · Analytics ✅
DuckDB, aggregates, anomaly, series forecast, SQL, Parquet.

## Phase 4 · System Graph maturity ✅
Full entity kinds, inference, blast radius, path, neighborhood.

## Phase 5 · Intelligence products ✅
Affected, Next, Fix, Getting Worse, Optimize, alert compression, report suite.

## Phase 6 · AI ✅
Fact → explanation, deterministic / local / cloud modes.

## Phase 7 · Enterprise ✅
- Local auth (admin / sre / viewer)
- SSO provider config (OIDC + LDAP) with enable toggle + OIDC map login
- RBAC roles and permission checks
- Hash chained audit log + chain verify
- Offline signed enterprise license mint + install + machine fingerprint
- Fleet registry + agent heartbeats (Go agent updated)
- HA single → active_standby peer config
- Signed intelligence packs (ed25519 verify/install/mint)
- Enterprise console module (Rose Petal frozen)
- Tauri desktop scaffold under `desktop/`

## Design
**Rose Petal is FROZEN forever.** See `docs/DESIGN_SYSTEM.md`.

## Rule
Local first. Air gap ready. Intelligence before collectors. AI explains facts only.
