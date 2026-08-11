//! VERITAS core domain types.
//!
//! The System Intelligence Graph lives here: entities, edges, changes,
//! signals, incidents, forecasts — the vocabulary of engineering decisions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type EntityId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntityKind {
    Service,
    Database,
    Host,
    KubernetesCluster,
    Repository,
    Process,
    Container,
    Pod,
    Network,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: EntityId,
    pub kind: String,
    pub name: String,
    pub health: f64,
    #[serde(default)]
    pub labels: HashMap<String, String>,
    #[serde(default)]
    pub attributes: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub id: String,
    pub from: EntityId,
    pub to: EntityId,
    #[serde(rename = "type")]
    pub edge_type: String,
    pub weight: f64,
    pub observed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub id: String,
    pub kind: String,
    pub entity_id: EntityId,
    pub summary: String,
    pub from_version: Option<String>,
    pub to_version: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub source: String,
    #[serde(default)]
    pub correlation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    pub id: String,
    pub entity_id: EntityId,
    pub name: String,
    pub value: f64,
    pub unit: String,
    pub delta: f64,
    pub observed_at: DateTime<Utc>,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastRadius {
    pub services: u32,
    pub pods: u32,
    pub request_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub at: DateTime<Utc>,
    pub event: String,
    pub entity_id: EntityId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub id: String,
    pub title: String,
    pub status: String,
    pub confidence: f64,
    pub root_cause: String,
    pub blast_radius: BlastRadius,
    pub recommended_action: String,
    pub expected_impact: String,
    pub started_at: DateTime<Utc>,
    pub timeline: Vec<TimelineEvent>,
    #[serde(default)]
    pub causal_chain: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Forecast {
    pub id: String,
    pub entity_id: EntityId,
    pub resource: String,
    pub utilization: f64,
    pub days_to_saturation: Option<f64>,
    pub risk: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostInsight {
    pub entity_id: EntityId,
    pub monthly_cost_usd: f64,
    pub cpu_util: f64,
    pub mem_util: f64,
    pub peak_util: f64,
    pub saving_usd: f64,
    pub reliability_risk: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub priority: u32,
    pub title: String,
    pub rationale: String,
    pub entity_id: EntityId,
    pub impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReport {
    pub date: String,
    pub overall_health: f64,
    pub changes: HashMap<String, u32>,
    pub anomalies_detected: u32,
    pub high_significance: u32,
    pub potential_incidents: u32,
    pub performance_degradation: String,
    pub capacity_concern: String,
    pub security_concern: String,
    pub cost_opportunity_usd: f64,
    pub recommended_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemOverview {
    pub health: f64,
    pub entities: u32,
    pub active_incidents: u32,
    pub open_actions: u32,
    pub meaningful_changes_24h: u32,
    pub related_to_degradation: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub generated_at: DateTime<Utc>,
    pub narrative: String,
    pub entities: Vec<Entity>,
    pub edges: Vec<Edge>,
    pub changes: Vec<Change>,
    pub signals: Vec<Signal>,
    pub incidents: Vec<Incident>,
    pub forecasts: Vec<Forecast>,
    pub cost_insights: Vec<CostInsight>,
    pub actions: Vec<Action>,
    pub daily_report: DailyReport,
    pub system_overview: SystemOverview,
}

/// WHY engine response — signature product shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhyAnalysis {
    pub what: String,
    pub when: DateTime<Utc>,
    pub where_entity: EntityId,
    pub what_changed: Vec<String>,
    pub depends_on: Vec<EntityId>,
    pub affected: BlastRadius,
    pub possible_causes: Vec<CauseHypothesis>,
    pub recommended_action: String,
    pub expected_impact: String,
    pub confidence: f64,
    pub causal_chain: Vec<String>,
    pub timeline: Vec<TimelineEvent>,
    pub evidence: Vec<Signal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CauseHypothesis {
    pub summary: String,
    pub probability: f64,
    pub change_id: Option<String>,
}

/// WHAT CHANGED response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatChangedReport {
    pub window: String,
    pub meaningful_changes: u32,
    pub related_to_degradation: u32,
    pub primary: Option<Change>,
    pub changes: Vec<Change>,
    pub observed_after: Vec<String>,
    pub causal_chain: Vec<String>,
    pub incident: Option<Incident>,
}

/// Archaeology (slow degradation).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchaeologyReport {
    pub entity_id: EntityId,
    pub entity_name: String,
    pub window: String,
    pub performance: HashMap<String, f64>,
    pub errors_delta: f64,
    pub cpu_delta: f64,
    pub memory_delta: f64,
    pub database_query_latency_delta: f64,
    pub deployments: u32,
    pub incidents: u32,
    pub likely_degradation: String,
    pub narrative: String,
}

/// Phase 5 · What is affected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffectedReport {
    pub origin: EntityId,
    pub incident_id: Option<String>,
    pub services: Vec<EntityId>,
    pub databases: Vec<EntityId>,
    pub pods: Vec<EntityId>,
    pub hosts: Vec<EntityId>,
    pub blast: BlastRadius,
    pub customer_impact: String,
    pub slo_risk: String,
}

/// Phase 5 · What will happen next
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextReport {
    pub generated_at: DateTime<Utc>,
    pub items: Vec<NextItem>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextItem {
    pub entity_id: EntityId,
    pub kind: String,
    pub title: String,
    pub urgency: String,
    pub eta: String,
    pub evidence: String,
}

/// Phase 5 · Getting worse fleet view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GettingWorseReport {
    pub window: String,
    pub entities: Vec<DegradationEntity>,
    pub worst: Option<EntityId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DegradationEntity {
    pub entity_id: EntityId,
    pub name: String,
    pub score: f64,
    pub p99_delta: f64,
    pub error_delta: f64,
    pub level: String,
}

/// Phase 5 · Optimize opportunities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizeReport {
    pub opportunities: Vec<OptimizeItem>,
    pub total_monthly_save_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizeItem {
    pub entity_id: EntityId,
    pub category: String,
    pub title: String,
    pub save_usd: f64,
    pub reliability_risk: String,
    pub rationale: String,
}

/// Phase 5 · Alert compression
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertCompressionReport {
    pub raw_alerts: u32,
    pub clusters: u32,
    pub incidents: u32,
    pub root_causes: u32,
    pub actions: u32,
    pub pipeline: Vec<CompressionStage>,
    pub clusters_detail: Vec<AlertCluster>,
    pub recommended_actions: Vec<Action>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionStage {
    pub name: String,
    pub count: u32,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertCluster {
    pub id: String,
    pub title: String,
    pub alert_count: u32,
    pub entity_ids: Vec<EntityId>,
    pub severity: String,
    pub linked_incident: Option<String>,
}

/// Phase 5 · Report suite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSuite {
    pub daily: DailyReport,
    pub weekly: WeeklyReport,
    pub capacity: String,
    pub cost: String,
    pub security: String,
    pub postmortem_draft: String,
    pub incident: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyReport {
    pub window: String,
    pub deployments: u32,
    pub incidents: u32,
    pub mttr_minutes: f64,
    pub error_budget_burn: f64,
    pub top_regressed: Vec<String>,
    pub narrative: String,
}

/// Phase 6 · Structured facts for AI (never raw log oceans alone)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactBundle {
    pub id: String,
    pub kind: String,
    pub facts: serde_json::Value,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Explanation {
    pub mode: String,
    pub title: String,
    pub summary: String,
    pub sections: Vec<ExplanationSection>,
    pub caveats: Vec<String>,
    pub facts_id: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplanationSection {
    pub heading: String,
    pub body: String,
}

/// Product identity constants.
pub const PRODUCT_NAME: &str = "VERITAS";
pub const PRODUCT_LATIN: &str =
    "Vis Explorationis Rerum Intelligentia Technica Analytica Systematica";
pub const PRODUCT_TAGLINE: &str =
    "The power of exploring systems through systematic technical analytical intelligence.";
pub const PRODUCT_PITCH: &str =
    "Observability tells you what happened. VERITAS tells you why, what changed, what's next, and what to do.";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_identity() {
        assert_eq!(PRODUCT_NAME, "VERITAS");
        assert!(PRODUCT_LATIN.contains("Intelligentia"));
    }
}
