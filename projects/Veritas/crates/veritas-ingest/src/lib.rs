//! Phase 2 telemetry fabric.
//!
//! Ingest OpenTelemetry (JSON simplified) and Prometheus points.
//! Best effort Docker / Kubernetes discovery.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::sync::{Arc, RwLock};
use uuid::Uuid;
use veritas_core::Entity;

const MAX_METRICS: usize = 5000;
const MAX_LOGS: usize = 2000;
const MAX_SPANS: usize = 2000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricPoint {
    pub id: String,
    pub name: String,
    pub value: f64,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default)]
    pub resource: Option<String>,
    #[serde(default)]
    pub labels: HashMap<String, String>,
    pub observed_at: DateTime<Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogRecord {
    pub id: String,
    pub body: String,
    pub severity: String,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default)]
    pub resource: Option<String>,
    pub observed_at: DateTime<Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanRecord {
    pub id: String,
    pub trace_id: String,
    pub span_id: String,
    pub name: String,
    pub service: String,
    pub duration_ms: f64,
    pub status: String,
    pub observed_at: DateTime<Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelemetryStatus {
    pub metrics: usize,
    pub logs: usize,
    pub spans: usize,
    pub sources: usize,
    pub metrics_accepted: u64,
    pub logs_accepted: u64,
    pub spans_accepted: u64,
    pub last_ingest: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    pub docker_found: usize,
    pub kubernetes_found: usize,
    pub entities_added: usize,
    pub entities: Vec<Entity>,
    pub notes: Vec<String>,
}

#[derive(Debug, Default)]
struct FabricInner {
    metrics: Vec<MetricPoint>,
    logs: Vec<LogRecord>,
    spans: Vec<SpanRecord>,
    sources: HashMap<String, u64>,
    metrics_accepted: u64,
    logs_accepted: u64,
    spans_accepted: u64,
    last_ingest: Option<DateTime<Utc>>,
    discovered: Vec<Entity>,
}

#[derive(Clone, Default)]
pub struct TelemetryFabric {
    inner: Arc<RwLock<FabricInner>>,
}

impl TelemetryFabric {
    /// Production fabric starts empty. Live collectors fill it.
    pub fn new() -> Self {
        Self::default()
    }

    pub fn status(&self) -> TelemetryStatus {
        let g = self.inner.read().unwrap();
        TelemetryStatus {
            metrics: g.metrics.len(),
            logs: g.logs.len(),
            spans: g.spans.len(),
            sources: g.sources.len(),
            metrics_accepted: g.metrics_accepted,
            logs_accepted: g.logs_accepted,
            spans_accepted: g.spans_accepted,
            last_ingest: g.last_ingest,
        }
    }

    pub fn metrics(&self) -> Vec<MetricPoint> {
        let g = self.inner.read().unwrap();
        let mut v = g.metrics.clone();
        v.reverse();
        v
    }

    pub fn logs(&self) -> Vec<LogRecord> {
        let g = self.inner.read().unwrap();
        let mut v = g.logs.clone();
        v.reverse();
        v
    }

    pub fn spans(&self) -> Vec<SpanRecord> {
        let g = self.inner.read().unwrap();
        let mut v = g.spans.clone();
        v.reverse();
        v
    }

    pub fn discovered(&self) -> DiscoveryResult {
        let g = self.inner.read().unwrap();
        DiscoveryResult {
            docker_found: g
                .discovered
                .iter()
                .filter(|e| e.kind == "container")
                .count(),
            kubernetes_found: g
                .discovered
                .iter()
                .filter(|e| e.kind == "pod" || e.kind == "kubernetes_cluster")
                .count(),
            entities_added: g.discovered.len(),
            entities: g.discovered.clone(),
            notes: vec![],
        }
    }

    pub fn ingest_metric(&self, mut m: MetricPoint) {
        let mut g = self.inner.write().unwrap();
        if m.id.is_empty() {
            m.id = Uuid::new_v4().to_string();
        }
        g.sources
            .entry(m.source.clone())
            .and_modify(|c| *c += 1)
            .or_insert(1);
        g.metrics_accepted += 1;
        g.last_ingest = Some(Utc::now());
        g.metrics.push(m);
        if g.metrics.len() > MAX_METRICS {
            let drain = g.metrics.len() - MAX_METRICS;
            g.metrics.drain(0..drain);
        }
    }

    pub fn ingest_log(&self, mut l: LogRecord) {
        let mut g = self.inner.write().unwrap();
        if l.id.is_empty() {
            l.id = Uuid::new_v4().to_string();
        }
        g.sources
            .entry(l.source.clone())
            .and_modify(|c| *c += 1)
            .or_insert(1);
        g.logs_accepted += 1;
        g.last_ingest = Some(Utc::now());
        g.logs.push(l);
        if g.logs.len() > MAX_LOGS {
            let drain = g.logs.len() - MAX_LOGS;
            g.logs.drain(0..drain);
        }
    }

    pub fn ingest_span(&self, mut s: SpanRecord) {
        let mut g = self.inner.write().unwrap();
        if s.id.is_empty() {
            s.id = Uuid::new_v4().to_string();
        }
        g.sources
            .entry(s.source.clone())
            .and_modify(|c| *c += 1)
            .or_insert(1);
        g.spans_accepted += 1;
        g.last_ingest = Some(Utc::now());
        g.spans.push(s);
        if g.spans.len() > MAX_SPANS {
            let drain = g.spans.len() - MAX_SPANS;
            g.spans.drain(0..drain);
        }
    }

    /// Simplified OTLP metrics JSON: `{ "resourceMetrics": [ { "scopeMetrics": [ { "metrics": [ { "name", "gauge": { "dataPoints": [ { "asDouble", "timeUnixNano" } ] } } ] } ] } ] }`
    /// Also accepts a flat list: `{ "metrics": [ { "name", "value", "entity_id?" } ] }`
    pub fn ingest_otel_metrics_json(&self, value: &serde_json::Value) -> u64 {
        let mut count = 0u64;
        if let Some(arr) = value.get("metrics").and_then(|v| v.as_array()) {
            for item in arr {
                let name = item
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                let val = item
                    .get("value")
                    .and_then(|v| v.as_f64())
                    .or_else(|| item.get("asDouble").and_then(|v| v.as_f64()))
                    .unwrap_or(0.0);
                let entity_id = item
                    .get("entity_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                self.ingest_metric(MetricPoint {
                    id: String::new(),
                    name,
                    value: val,
                    unit: item
                        .get("unit")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    entity_id,
                    resource: item
                        .get("resource")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    labels: HashMap::new(),
                    observed_at: Utc::now(),
                    source: "otel".into(),
                });
                count += 1;
            }
        }
        // Walk resourceMetrics lightly
        if let Some(rms) = value.get("resourceMetrics").and_then(|v| v.as_array()) {
            for rm in rms {
                let resource = rm
                    .pointer("/resource/attributes/0/value/stringValue")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                if let Some(sms) = rm.get("scopeMetrics").and_then(|v| v.as_array()) {
                    for sm in sms {
                        if let Some(metrics) = sm.get("metrics").and_then(|v| v.as_array()) {
                            for m in metrics {
                                let name = m
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("metric")
                                    .to_string();
                                let points = m
                                    .pointer("/gauge/dataPoints")
                                    .or_else(|| m.pointer("/sum/dataPoints"))
                                    .and_then(|v| v.as_array());
                                if let Some(points) = points {
                                    for p in points {
                                        let val = p
                                            .get("asDouble")
                                            .and_then(|v| v.as_f64())
                                            .or_else(|| p.get("asInt").and_then(|v| v.as_f64()))
                                            .unwrap_or(0.0);
                                        self.ingest_metric(MetricPoint {
                                            id: String::new(),
                                            name: name.clone(),
                                            value: val,
                                            unit: None,
                                            entity_id: None,
                                            resource: resource.clone(),
                                            labels: HashMap::new(),
                                            observed_at: Utc::now(),
                                            source: "otel".into(),
                                        });
                                        count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        count
    }

    pub fn ingest_otel_logs_json(&self, value: &serde_json::Value) -> u64 {
        let mut count = 0u64;
        if let Some(arr) = value.get("logs").and_then(|v| v.as_array()) {
            for item in arr {
                self.ingest_log(LogRecord {
                    id: String::new(),
                    body: item
                        .get("body")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    severity: item
                        .get("severity")
                        .and_then(|v| v.as_str())
                        .unwrap_or("INFO")
                        .to_string(),
                    entity_id: item
                        .get("entity_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    resource: item
                        .get("resource")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    observed_at: Utc::now(),
                    source: "otel".into(),
                });
                count += 1;
            }
        }
        count
    }

    pub fn ingest_otel_traces_json(&self, value: &serde_json::Value) -> u64 {
        let mut count = 0u64;
        if let Some(arr) = value.get("spans").and_then(|v| v.as_array()) {
            for item in arr {
                self.ingest_span(SpanRecord {
                    id: String::new(),
                    trace_id: item
                        .get("trace_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("0")
                        .to_string(),
                    span_id: item
                        .get("span_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("0")
                        .to_string(),
                    name: item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("span")
                        .to_string(),
                    service: item
                        .get("service")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    duration_ms: item
                        .get("duration_ms")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0),
                    status: item
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("OK")
                        .to_string(),
                    observed_at: Utc::now(),
                    source: "otel".into(),
                });
                count += 1;
            }
        }
        count
    }

    /// Prometheus style: `{ "timeseries": [ { "name", "value", "labels"? } ] }`
    pub fn ingest_prometheus_json(&self, value: &serde_json::Value) -> u64 {
        let mut count = 0u64;
        let arr = value
            .get("timeseries")
            .or_else(|| value.get("metrics"))
            .and_then(|v| v.as_array());
        if let Some(arr) = arr {
            for item in arr {
                let name = item
                    .get("name")
                    .or_else(|| item.get("__name__"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("metric")
                    .to_string();
                let val = item.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let mut labels = HashMap::new();
                if let Some(obj) = item.get("labels").and_then(|v| v.as_object()) {
                    for (k, v) in obj {
                        if let Some(s) = v.as_str() {
                            labels.insert(k.clone(), s.to_string());
                        }
                    }
                }
                let entity_id = labels.get("service").map(|s| format!("svc:{s}"));
                self.ingest_metric(MetricPoint {
                    id: String::new(),
                    name,
                    value: val,
                    unit: None,
                    entity_id,
                    resource: labels.get("job").cloned(),
                    labels,
                    observed_at: Utc::now(),
                    source: "prometheus".into(),
                });
                count += 1;
            }
        }
        count
    }

    pub fn scan_discovery(&self) -> DiscoveryResult {
        let mut notes = Vec::new();
        let mut entities = Vec::new();
        let mut docker_found = 0usize;
        let mut kubernetes_found = 0usize;

        // Docker
        match Command::new("docker")
            .args(["ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}"])
            .output()
        {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines().filter(|l| !l.trim().is_empty()).take(20) {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 2 {
                        docker_found += 1;
                        let id = parts[0];
                        let name = parts[1];
                        let image = parts.get(2).copied().unwrap_or("");
                        let mut labels = HashMap::new();
                        labels.insert("image".into(), image.into());
                        labels.insert("runtime".into(), "docker".into());
                        entities.push(Entity {
                            id: format!("ctr:{}", &id[..id.len().min(12)]),
                            kind: "container".into(),
                            name: name.into(),
                            health: 0.95,
                            labels,
                            attributes: HashMap::new(),
                        });
                    }
                }
                if docker_found == 0 {
                    notes.push("Docker available. No running containers.".into());
                }
            }
            Ok(_) => notes.push("Docker command failed.".into()),
            Err(_) => notes.push("Docker not available on this host.".into()),
        }

        // Kubernetes
        match Command::new("kubectl")
            .args([
                "get",
                "pods",
                "-A",
                "--no-headers",
                "-o",
                "custom-columns=NS:.metadata.namespace,NAME:.metadata.name,PHASE:.status.phase",
            ])
            .output()
        {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines().filter(|l| !l.trim().is_empty()).take(30) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        kubernetes_found += 1;
                        let ns = parts[0];
                        let name = parts[1];
                        let phase = parts.get(2).copied().unwrap_or("Unknown");
                        let mut labels = HashMap::new();
                        labels.insert("namespace".into(), ns.into());
                        labels.insert("phase".into(), phase.into());
                        entities.push(Entity {
                            id: format!("pod:{ns}/{name}"),
                            kind: "pod".into(),
                            name: format!("{ns}/{name}"),
                            health: if phase == "Running" { 0.96 } else { 0.5 },
                            labels,
                            attributes: HashMap::new(),
                        });
                    }
                }
                if kubernetes_found == 0 {
                    notes.push("kubectl available. No pods returned.".into());
                }
            }
            Ok(_) => notes.push("kubectl failed. Check cluster access.".into()),
            Err(_) => notes.push("kubectl not available on this host.".into()),
        }

        let entities_added = entities.len();
        {
            let mut g = self.inner.write().unwrap();
            g.discovered = entities.clone();
            g.last_ingest = Some(Utc::now());
        }

        // Emit a discovery metric
        self.ingest_metric(MetricPoint {
            id: String::new(),
            name: "veritas_discovery_entities".into(),
            value: entities_added as f64,
            unit: Some("count".into()),
            entity_id: None,
            resource: Some("discovery".into()),
            labels: HashMap::new(),
            observed_at: Utc::now(),
            source: "discovery".into(),
        });

        DiscoveryResult {
            docker_found,
            kubernetes_found,
            entities_added,
            entities,
            notes,
        }
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_then_ingest() {
        let f = TelemetryFabric::new();
        let s = f.status();
        assert_eq!(s.metrics, 0);
        assert_eq!(s.logs, 0);
        assert_eq!(s.spans, 0);

        let n = f.ingest_prometheus_json(&serde_json::json!({
            "timeseries": [{ "name": "up", "value": 1.0, "labels": { "job": "api" } }]
        }));
        assert_eq!(n, 1);
        assert_eq!(f.status().metrics, 1);
    }
}
