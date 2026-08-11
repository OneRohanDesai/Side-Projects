# System Intelligence Graph · Entity Model (Phase 4)

## Philosophy

Model **entities** and **relationships**. Telemetry attaches to entities.

## Entity kinds (Phase 4)

| Kind | Examples |
| --- | --- |
| service | checkout, payment |
| database | postgres, redis |
| host | node-17 |
| node | k8s worker view |
| kubernetes_cluster | prod-cluster |
| namespace | prod |
| deployment | checkout deploy |
| pod | checkout-7f9c |
| container | checkout-app |
| process | checkout-server, postgres |
| network | checkout:8080, postgres:5432 |
| repository | git repo |

## Edge types

| Type | Meaning |
| --- | --- |
| calls | Runtime service hop |
| uses | Resource dependency |
| deployed_on | Placement |
| runs_on | Hosting |
| runs | Process runtime |
| contains | Ownership / composition |
| exposes | Network surface |
| produced_by | Provenance |
| depends_on | Hard dependency |
| routes_to | Network path |

## Blast radius

Undirected BFS from origin to depth N. Returns:
- entity set
- counts by kind
- estimated request share
- traversed edges
- critical path seeds

## Path

Undirected shortest path for causal narrative (e.g. service → database).

## Inference

Heuristic edge creation from co-location and naming (service↔database, container↔process, pod↔host).

## Sample topology

Enriched on control plane boot via `SystemGraph::enrich_phase4_topology()`.
