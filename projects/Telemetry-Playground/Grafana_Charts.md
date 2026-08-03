````markdown
# Grafana Dashboards

## Metrics Dashboard (Prometheus)

| Panel | Query | Visualization |
|-------|-------|---------------|
| Total Packets Received | `sum(telemetry_packets_received_total)` | Stat |
| Packets/sec | `sum(rate(telemetry_packets_received_total[1m]))` | Time Series |
| Traffic by Receiver | `sum by (receiver) (rate(telemetry_packets_received_total[1m]))` | Time Series |
| Traffic by Generator | `sum by (generator) (rate(telemetry_packets_sent_total[1m]))` | Time Series |
| Average Latency | `rate(telemetry_request_latency_seconds_sum[1m]) / rate(telemetry_request_latency_seconds_count[1m])` | Gauge / Time Series |
| P95 Latency | `histogram_quantile(0.95, rate(telemetry_request_latency_seconds_bucket[5m]))` | Time Series |

**Expected Dashboard**
- Total Packets Received
- Packets/sec
- Traffic by Generator
- Traffic by Receiver
- Average Latency
- P95 Latency

---

## Logs Dashboard (Loki)

> **Datasource:** Loki  
> **Refresh Interval:** 5s

| Panel | Query | Visualization |
|-------|-------|---------------|
| Receiver Logs | `{container=~"receiver-.*"}` | Logs |
| Generator Logs | `{container=~"generator-.*"}` | Logs |
| Nginx Access Logs | `{container="nginx"}` | Logs |
| Application Errors | `{container=~"receiver-.*\|generator-.*"} \|= "ERROR"` | Logs |
| HTTP 500s | `{container="nginx"} \|= "500"` | Logs |
| Generator 1 | `{container="generator-1"}` | Logs |
| Generator 2 | `{container="generator-2"}` | Logs |
| Generator 3 | `{container="generator-3"}` | Logs |
| Receiver 1 | `{container="receiver-1"}` | Logs |
| Receiver 2 | `{container="receiver-2"}` | Logs |
| Receiver 3 | `{container="receiver-3"}` | Logs |

### Suggested Layout

```text
--------------------------------------------------------
Receiver Logs          | Generator Logs
--------------------------------------------------------
Nginx                  | Application Errors
--------------------------------------------------------
Receiver-1 | Receiver-2 | Receiver-3
--------------------------------------------------------
Generator-1 | Generator-2 | Generator-3
--------------------------------------------------------
HTTP 500s
--------------------------------------------------------
```

> **Note:** Use Grafana dashboards primarily for metrics. Logs are best explored interactively in **Grafana Explore**.
````
