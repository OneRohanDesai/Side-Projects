# Plugin Architecture

Plugin-native from day one. The platform must not hardcode every integration forever.

## Layout

```
plugins/
├── prometheus/
├── kubernetes/
├── docker/
├── linux/
├── postgres/
├── otel/
├── mysql/        (future)
├── nginx/        (future)
├── kafka/        (future)
├── redis/        (future)
├── aws/          (future)
├── azure/        (future)
├── gcp/          (future)
├── github/       (future)
└── custom/
```

## What a plugin provides

| Capability | Description |
| --- | --- |
| `manifest` | id, version, edition requirements, capabilities |
| `collector` | how to scrape/pull/stream data |
| `entities` | entity kinds + identity rules |
| `relationships` | edge inference rules |
| `metrics/logs/events` | schema mappings |
| `health_checks` | optional liveness of the source |
| `analytics_hooks` | domain-specific rollups |
| `ui_hints` | icons, deep-links, card templates |

## Manifest shape

```json
{
  "id": "prometheus",
  "name": "Prometheus",
  "version": "0.1.0",
  "capabilities": ["metrics", "entities"],
  "edition": "free",
  "config_schema": {
    "endpoints": { "type": "array", "items": "string" }
  }
}
```

## Runtime contract (Phase 1)
- Plugins are **declarative manifests + sample descriptors** loaded by the control plane
- No dynamic code loading yet (security)

## Runtime contract (target)
- Signed plugin packages
- WASM or native sidecar collectors
- Capability tokens from license engine
- Hot reload without plane restart where safe

## Intelligence packs (premium)
Separately from connectors, VERITAS may distribute signed:
- detection packs
- anomaly models
- rule packs
- analysis packs

These evolve the intelligence without requiring a full product upgrade — still executable fully offline once installed.
