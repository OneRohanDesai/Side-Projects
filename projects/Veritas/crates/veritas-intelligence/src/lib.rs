//! Intelligence engine — the middle layer that is the product.
//!
//! Deterministic analysis first. Works on live store data (empty until projects connect).

mod phase5;

use chrono::Utc;
use std::collections::HashMap;
use veritas_core::*;
use veritas_storage::Store;

pub struct IntelligenceEngine {
    store: Store,
}

impl IntelligenceEngine {
    pub fn new(store: Store) -> Self {
        Self { store }
    }

    pub fn store(&self) -> &Store {
        &self.store
    }

    pub fn overview(&self) -> SystemOverview {
        self.store.overview()
    }

    pub fn what_changed(&self, window: &str) -> WhatChangedReport {
        let snap = self.store.snapshot();
        let mut changes = snap.changes.clone();
        changes.sort_by(|a, b| {
            b.correlation
                .partial_cmp(&a.correlation)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let primary = changes.first().cloned();
        let incident = snap.incidents.first().cloned();

        let observed_after: Vec<String> = snap
            .signals
            .iter()
            .take(8)
            .map(|s| {
                format!(
                    "{} on {} · Δ{:.0}%",
                    s.name,
                    s.entity_id,
                    s.delta * 100.0
                )
            })
            .collect();

        let causal_chain = incident
            .as_ref()
            .map(|i| i.causal_chain.clone())
            .unwrap_or_default();

        WhatChangedReport {
            window: window.to_string(),
            meaningful_changes: snap.system_overview.meaningful_changes_24h.max(changes.len() as u32),
            related_to_degradation: snap.system_overview.related_to_degradation,
            primary,
            changes,
            observed_after,
            causal_chain,
            incident,
        }
    }

    pub fn why(&self, entity_id: Option<&str>) -> WhyAnalysis {
        let snap = self.store.snapshot();
        let target = entity_id
            .map(|s| s.to_string())
            .or_else(|| snap.entities.first().map(|e| e.id.clone()))
            .unwrap_or_else(|| "system".into());

        if let Some(incident) = snap
            .incidents
            .iter()
            .find(|i| i.timeline.iter().any(|t| t.entity_id == target))
            .cloned()
            .or_else(|| snap.incidents.first().cloned())
        {
            let depends: Vec<EntityId> = snap
                .edges
                .iter()
                .filter(|e| e.from == target)
                .map(|e| e.to.clone())
                .collect();

            let evidence: Vec<Signal> = snap
                .signals
                .iter()
                .filter(|s| s.entity_id == target || s.entity_id.starts_with("db:"))
                .cloned()
                .collect();

            let mut causes: Vec<CauseHypothesis> = snap
                .changes
                .iter()
                .filter(|c| c.entity_id == target || c.correlation > 0.5)
                .map(|c| CauseHypothesis {
                    summary: c.summary.clone(),
                    probability: c.correlation,
                    change_id: Some(c.id.clone()),
                })
                .collect();
            causes.sort_by(|a, b| {
                b.probability
                    .partial_cmp(&a.probability)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            return WhyAnalysis {
                what: incident.title.clone(),
                when: incident.started_at,
                where_entity: target,
                what_changed: causes.iter().map(|c| c.summary.clone()).collect(),
                depends_on: depends,
                affected: incident.blast_radius.clone(),
                possible_causes: causes,
                recommended_action: incident.recommended_action.clone(),
                expected_impact: incident.expected_impact.clone(),
                confidence: incident.confidence,
                causal_chain: incident.causal_chain.clone(),
                timeline: incident.timeline.clone(),
                evidence,
            };
        }

        // Empty / no incident: still return a structured idle analysis
        let depends: Vec<EntityId> = snap
            .edges
            .iter()
            .filter(|e| e.from == target)
            .map(|e| e.to.clone())
            .collect();
        let evidence: Vec<Signal> = snap
            .signals
            .iter()
            .filter(|s| s.entity_id == target)
            .cloned()
            .collect();

        WhyAnalysis {
            what: if snap.entities.is_empty() {
                "No live systems connected".into()
            } else {
                format!("No active incident on {target}")
            },
            when: Utc::now(),
            where_entity: target,
            what_changed: snap.changes.iter().map(|c| c.summary.clone()).collect(),
            depends_on: depends,
            affected: BlastRadius {
                services: 0,
                pods: 0,
                request_pct: 0.0,
            },
            possible_causes: vec![],
            recommended_action: if snap.entities.is_empty() {
                "Register a project or start agents to begin analysis".into()
            } else {
                "Continue monitoring · no rollback required".into()
            },
            expected_impact: "n/a".into(),
            confidence: 0.0,
            causal_chain: vec![],
            timeline: vec![],
            evidence,
        }
    }

    pub fn forecast(&self) -> Vec<Forecast> {
        self.store.snapshot().forecasts.clone()
    }

    pub fn archaeology(&self, entity_id: &str) -> Option<ArchaeologyReport> {
        let e = self.store.entity(entity_id)?;
        let attrs = &e.attributes;

        let f = |key: &str| -> f64 {
            attrs.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
        };
        let u = |key: &str| -> u32 {
            attrs.get(key).and_then(|v| v.as_u64()).unwrap_or(0) as u32
        };
        let s = |key: &str| -> String {
            attrs
                .get(key)
                .and_then(|v| v.as_str())
                .unwrap_or("UNKNOWN")
                .to_string()
        };

        let mut performance = HashMap::new();
        performance.insert("p50".into(), f("p50_change_30d"));
        performance.insert("p95".into(), f("p95_change_30d"));
        performance.insert("p99".into(), f("p99_change_30d"));

        let degradation = s("degradation");
        let narrative = if degradation == "HIGH" {
            format!(
                "Over the observation window, {} shows elevated latency and error pressure.",
                e.name
            )
        } else if e.health < 0.85 {
            format!("{} health is {:.0}% · watch for regression.", e.name, e.health * 100.0)
        } else {
            format!("{} is within expected variance.", e.name)
        };

        Some(ArchaeologyReport {
            entity_id: e.id.clone(),
            entity_name: e.name.clone(),
            window: "Live window".into(),
            performance,
            errors_delta: f("error_change_30d"),
            cpu_delta: f("cpu_change_30d"),
            memory_delta: f("memory_change_30d"),
            database_query_latency_delta: f("db_latency_change_30d"),
            deployments: u("deployments_30d"),
            incidents: u("incidents_30d"),
            likely_degradation: if degradation == "UNKNOWN" {
                if e.health < 0.85 {
                    "MED".into()
                } else {
                    "LOW".into()
                }
            } else {
                degradation
            },
            narrative,
        })
    }

    pub fn actions(&self) -> Vec<Action> {
        self.store.snapshot().actions.clone()
    }

    pub fn daily_report(&self) -> DailyReport {
        self.store.snapshot().daily_report.clone()
    }

    pub fn incidents(&self) -> Vec<Incident> {
        self.store.snapshot().incidents.clone()
    }

    pub fn cost_insights(&self) -> Vec<CostInsight> {
        self.store.snapshot().cost_insights.clone()
    }

    pub fn entity_card(&self, id: &str) -> Option<EntityCard> {
        let e = self.store.entity(id)?;
        let deps: Vec<String> = self
            .store
            .snapshot()
            .edges
            .iter()
            .filter(|edge| edge.from == id)
            .map(|edge| edge.to.clone())
            .collect();
        let cost = self
            .store
            .snapshot()
            .cost_insights
            .iter()
            .find(|c| c.entity_id == id)
            .cloned();
        let why_available = self
            .store
            .snapshot()
            .incidents
            .iter()
            .any(|i| i.timeline.iter().any(|t| t.entity_id == id));

        Some(EntityCard {
            entity: e,
            dependencies: deps,
            cost,
            why_available,
            generated_at: Utc::now(),
        })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EntityCard {
    pub entity: Entity,
    pub dependencies: Vec<String>,
    pub cost: Option<CostInsight>,
    pub why_available: bool,
    pub generated_at: chrono::DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use veritas_storage::Store;

    #[test]
    fn empty_store_why_does_not_panic() {
        let engine = IntelligenceEngine::new(Store::empty());
        let why = engine.why(None);
        assert!(why.confidence == 0.0);
        assert!(why.what.contains("No live") || why.recommended_action.contains("Register"));
    }

    #[test]
    fn empty_what_changed() {
        let engine = IntelligenceEngine::new(Store::empty());
        let report = engine.what_changed("1h");
        assert!(report.changes.is_empty());
        assert!(report.primary.is_none());
    }

    #[test]
    fn phase5_on_empty() {
        let engine = IntelligenceEngine::new(Store::empty());
        let ac = engine.alert_compression();
        assert_eq!(ac.raw_alerts, 0);
        let worse = engine.getting_worse();
        assert!(worse.entities.is_empty());
    }
}
