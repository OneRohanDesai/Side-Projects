# Data Model & Schema (Phase 1)

Phase 1 keeps **4–5 sample records per table** in memory (JSON-backed).  
Schemas are production-shaped so DuckDB/Parquet migration is additive.

## Tables

### entities
| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | `kind:name` |
| kind | TEXT | service, host, database, … |
| name | TEXT | display name |
| health | REAL | 0–1 |
| labels_json | TEXT | JSON map |
| attributes_json | TEXT | JSON map |
| updated_at | TIMESTAMPTZ | |

### edges
| Column | Type |
| --- | --- |
| id | TEXT PK |
| from_id | TEXT FK |
| to_id | TEXT FK |
| edge_type | TEXT |
| weight | REAL |
| observed | BOOL |

### changes
| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| kind | TEXT | deployment, config, infra, flag, schema |
| entity_id | TEXT | primary affected entity |
| summary | TEXT | |
| from_version | TEXT | nullable |
| to_version | TEXT | nullable |
| occurred_at | TIMESTAMPTZ | |
| source | TEXT | git, ci, k8s, terraform |

### signals
| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| entity_id | TEXT | |
| name | TEXT | latency, error_rate, pool_util, … |
| value | REAL | |
| unit | TEXT | |
| delta | REAL | relative change |
| observed_at | TIMESTAMPTZ | |
| severity | TEXT | info, warn, high, critical |

### incidents
| Column | Type |
| --- | --- |
| id | TEXT PK |
| title | TEXT |
| status | TEXT |
| confidence | REAL |
| root_cause | TEXT |
| blast_radius_json | TEXT |
| recommended_action | TEXT |
| expected_impact | TEXT |
| started_at | TIMESTAMPTZ |
| timeline_json | TEXT |

### forecasts
| Column | Type |
| --- | --- |
| id | TEXT PK |
| entity_id | TEXT |
| resource | TEXT |
| utilization | REAL |
| days_to_saturation | REAL nullable |
| risk | TEXT |
| recommendation | TEXT |

### cost_insights
| Column | Type |
| --- | --- |
| entity_id | TEXT PK |
| monthly_cost_usd | REAL |
| cpu_util | REAL |
| mem_util | REAL |
| peak_util | REAL |
| saving_usd | REAL |
| reliability_risk | TEXT |
| recommendation | TEXT |

## Storage roadmap
1. **Phase 1:** in-memory JSON (`sample-data/system.json`)
2. **Phase 2:** DuckDB file under `~/.veritas/data/`
3. **Phase 3:** Parquet partitions + optional ClickHouse
4. **Always:** Arrow as interchange between collectors and analytics

## Sample volume policy
Until ingestion is real: **≤ 5 records** per logical table in the demo fixture, plus the single rich incident timeline needed for UX narrative.
