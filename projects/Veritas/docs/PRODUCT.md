# VERITAS Product Blueprint

## Identity

| | |
| --- | --- |
| **Name** | VERITAS |
| **Latin** | Vis Explorationis Rerum Intelligentia Technica Analytica Systematica |
| **English** | The power of exploring systems through systematic technical analytical intelligence |
| **Category** | Engineering Intelligence Platform |
| **Not** | Grafana alternative · Open-source Datadog · Unified O11y UI |

## One-line pitch

> Your infrastructure already generates millions of facts every day. VERITAS turns those facts into engineering decisions.

## Alternate pitch

> Observability tells you what happened. We tell you why, what changed, what's next, and what to do.

## Product thesis

Existing tools are excellent at collecting and displaying telemetry. The gap is the **workflow**:

```
telemetry  →  system model  →  correlation  →  explanation  →  decision
```

VERITAS is a **reasoning engine over infrastructure data**. Collectors are inputs; decisions are outputs.

## Principles

1. **Local-first / privacy-first** — full value without mandatory cloud
2. **Linux-native** — eBPF, agents, systemd, containers first-class
3. **Questions primary, dashboards secondary** — zero-dashboard philosophy
4. **Deterministic analytics before LLMs** — AI explains facts, does not invent them
5. **Plugin-native** — integrations are not hardcoded forever
6. **Air-gap capable** — banks, defense, manufacturing, regulated environments
7. **Not boring** — professional power tools can still feel sharp and alive

## Feature tree (complete)

### A. Ingestion & data fabric
- OpenTelemetry (metrics, logs, traces)
- Prometheus remote-write / scrape compatibility
- eBPF system visibility (process, net, FS, sched)
- Syslog, files, Kafka, cloud APIs
- CI/CD & Git change feeds
- Cost / billing feeds (cloud + on-prem models)
- Security signals (not full SIEM replacement)
- Normalization → Arrow / schema map / enrichment

### B. System Intelligence Graph
- Entity types: Host, Process, Container, Pod, Service, Deployment, Database, Network, Repo, Cost Center, …
- Relationships: calls, uses, deployed-on, owns, depends-on, exposes, …
- Telemetry attachment to entities
- Historical entity state (archaeology)
- Topology + causal candidates

### C. Analytics engine
- Time-series aggregation
- OLAP / SQL over everything
- Statistics, baselines, seasonality
- Anomaly detection (deterministic first)
- Forecasting / saturation projection
- Correlation & change windows
- Semantic ops: Analyze · Explain · Correlate · Forecast · Compare · Investigate · Recommend

### D. Intelligence products (signature)
| Product | User intent |
| --- | --- |
| **What Changed?** | Ranked meaningful deltas + causal chains |
| **Why Engine** | RCA with confidence + evidence |
| **Forecast** | What will break / saturate / cost |
| **What Should I Fix?** | Alert compression → decisions |
| **System Archaeology** | Slow degradation over weeks/months |
| **Autonomous Reports** | Daily/weekly/capacity/cost/postmortem |

### E. Engineering intelligence domains
- **Reliability** — SLO/SLI, error budget, MTTR/MTBF
- **Performance** — latency, resources, pools, GC, queries
- **Capacity** — growth, saturation dates, recommendations
- **Change** — deploy/config/flag/schema correlation
- **Cost** — efficiency intelligence (cost × util × risk)
- **Security** — topology-linked anomalies (context, not full XDR)

### F. AI layer (optional, local-first)
- Consumes **structured facts**, never raw log oceans alone
- Local: Ollama / llama.cpp / vLLM-class
- Cloud: optional enterprise endpoints
- Roles: analyst, investigator, report writer, query assistant, summarizer
- Product works fully with AI disabled

### G. Platform
- Desktop UI (Tauri later) + web console
- Local control plane
- Auth (local + OIDC), RBAC, audit
- License engine (free/pro/enterprise)
- Plugin system + signed intelligence packs
- Agents + fleet (enterprise)

## Competitive stance

| Capability | Market | VERITAS edge |
| --- | --- | --- |
| Metrics/logs/traces UI | Crowded | Not the product |
| Unified O11y binary | OpenObserve et al. | Intelligence workflow |
| Causal / topology AI | Dynatrace | Local-first + cost + archaeology + change |
| Edge ML agent | Netdata | Full graph + engineering decisions |
| SIEM | Wazuh/Splunk | Contextual security only |

## Explicit non-goals (v1–v3)
- Replacing every Grafana dashboard
- Becoming a full SIEM/XDR
- Inventing a proprietary telemetry protocol
- Cloud-only SaaS as the default
- “LLM looks at logs” as the core value

## Success metrics (product)
- Time from alert → recommended action
- % of incidents with auto-ranked root cause ≥ confidence threshold
- Engineer sessions that never open a classic dashboard
- Air-gapped deployments that stay fully functional
