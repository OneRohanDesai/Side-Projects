//! Storage layer · production starts empty.
//!
//! Live entities, changes, incidents and signals are written as the fabric fills.

use anyhow::{Context, Result};
use chrono::Utc;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock};
use veritas_core::{
    Action, Change, CostInsight, DailyReport, Edge, Entity, EntityId, Forecast, Incident, Signal,
    SystemOverview, SystemSnapshot,
};

#[derive(Clone)]
pub struct Store {
    snapshot: Arc<RwLock<SystemSnapshot>>,
}

impl Store {
    pub fn empty() -> Self {
        Self::from_snapshot(empty_snapshot())
    }

    pub fn from_snapshot(snapshot: SystemSnapshot) -> Self {
        Self {
            snapshot: Arc::new(RwLock::new(snapshot)),
        }
    }

    pub fn load_path(path: &Path) -> Result<Self> {
        let raw = std::fs::read_to_string(path)
            .with_context(|| format!("read snapshot at {}", path.display()))?;
        let snapshot: SystemSnapshot =
            serde_json::from_str(&raw).context("parse system snapshot JSON")?;
        Ok(Self::from_snapshot(snapshot))
    }

    /// Optional path via VERITAS_SNAPSHOT_PATH · otherwise empty production state.
    pub fn load_production() -> Result<Self> {
        if let Ok(p) = std::env::var("VERITAS_SNAPSHOT_PATH") {
            let path = Path::new(&p);
            if path.exists() {
                return Self::load_path(path);
            }
        }
        Ok(Self::empty())
    }

    pub fn snapshot(&self) -> SystemSnapshot {
        self.snapshot.read().unwrap().clone()
    }

    pub fn with_snapshot<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&SystemSnapshot) -> R,
    {
        let g = self.snapshot.read().unwrap();
        f(&g)
    }

    pub fn entity(&self, id: &str) -> Option<Entity> {
        self.snapshot
            .read()
            .unwrap()
            .entities
            .iter()
            .find(|e| e.id == id)
            .cloned()
    }

    pub fn entities(&self) -> Vec<Entity> {
        self.snapshot.read().unwrap().entities.clone()
    }

    pub fn neighbors(&self, id: &EntityId) -> Vec<(String, EntityId)> {
        self.snapshot
            .read()
            .unwrap()
            .edges
            .iter()
            .filter(|e| e.from == *id || e.to == *id)
            .map(|e| {
                if e.from == *id {
                    (e.edge_type.clone(), e.to.clone())
                } else {
                    (e.edge_type.clone(), e.from.clone())
                }
            })
            .collect()
    }

    pub fn upsert_entity(&self, entity: Entity) {
        let mut g = self.snapshot.write().unwrap();
        if let Some(e) = g.entities.iter_mut().find(|e| e.id == entity.id) {
            *e = entity;
        } else {
            g.entities.push(entity);
        }
        g.system_overview.entities = g.entities.len() as u32;
        g.generated_at = Utc::now();
        recompute_health(&mut g);
    }

    pub fn upsert_edge(&self, edge: Edge) {
        let mut g = self.snapshot.write().unwrap();
        if let Some(e) = g
            .edges
            .iter_mut()
            .find(|e| e.from == edge.from && e.to == edge.to && e.edge_type == edge.edge_type)
        {
            *e = edge;
        } else {
            g.edges.push(edge);
        }
        g.generated_at = Utc::now();
    }

    pub fn replace_topology(&self, entities: Vec<Entity>, edges: Vec<Edge>) {
        let mut g = self.snapshot.write().unwrap();
        g.entities = entities;
        g.edges = edges;
        g.system_overview.entities = g.entities.len() as u32;
        g.generated_at = Utc::now();
        recompute_health(&mut g);
    }

    pub fn push_signal(&self, signal: Signal) {
        let mut g = self.snapshot.write().unwrap();
        g.signals.push(signal);
        if g.signals.len() > 5000 {
            let drain = g.signals.len() - 5000;
            g.signals.drain(0..drain);
        }
        g.generated_at = Utc::now();
    }

    pub fn push_change(&self, change: Change) {
        let mut g = self.snapshot.write().unwrap();
        g.changes.push(change);
        g.system_overview.meaningful_changes_24h = g.changes.len() as u32;
        g.generated_at = Utc::now();
    }

    pub fn push_incident(&self, incident: Incident) {
        let mut g = self.snapshot.write().unwrap();
        // replace same id or push
        if let Some(i) = g.incidents.iter_mut().find(|i| i.id == incident.id) {
            *i = incident;
        } else {
            g.incidents.push(incident);
        }
        g.system_overview.active_incidents =
            g.incidents.iter().filter(|i| i.status == "active").count() as u32;
        g.generated_at = Utc::now();
        recompute_health(&mut g);
    }

    pub fn set_actions(&self, actions: Vec<Action>) {
        let mut g = self.snapshot.write().unwrap();
        g.system_overview.open_actions = actions.len() as u32;
        g.actions = actions;
    }

    pub fn set_forecasts(&self, forecasts: Vec<Forecast>) {
        let mut g = self.snapshot.write().unwrap();
        g.forecasts = forecasts;
    }

    pub fn set_cost_insights(&self, costs: Vec<CostInsight>) {
        let mut g = self.snapshot.write().unwrap();
        g.cost_insights = costs;
    }

    pub fn set_narrative(&self, narrative: impl Into<String>) {
        let mut g = self.snapshot.write().unwrap();
        g.narrative = narrative.into();
    }

    pub fn set_daily_report(&self, report: DailyReport) {
        let mut g = self.snapshot.write().unwrap();
        g.daily_report = report;
    }

    pub fn overview(&self) -> SystemOverview {
        self.snapshot.read().unwrap().system_overview.clone()
    }
}

fn recompute_health(g: &mut SystemSnapshot) {
    if g.entities.is_empty() {
        g.system_overview.health = 1.0;
        return;
    }
    let sum: f64 = g.entities.iter().map(|e| e.health).sum();
    g.system_overview.health = sum / g.entities.len() as f64;
    g.system_overview.entities = g.entities.len() as u32;
    g.system_overview.active_incidents =
        g.incidents.iter().filter(|i| i.status == "active").count() as u32;
    g.system_overview.open_actions = g.actions.len() as u32;
}

pub fn empty_snapshot() -> SystemSnapshot {
    SystemSnapshot {
        generated_at: Utc::now(),
        narrative: "No project connected. Waiting for live systems.".into(),
        entities: vec![],
        edges: vec![],
        changes: vec![],
        signals: vec![],
        incidents: vec![],
        forecasts: vec![],
        cost_insights: vec![],
        actions: vec![],
        daily_report: DailyReport {
            date: Utc::now().format("%Y-%m-%d").to_string(),
            overall_health: 1.0,
            changes: HashMap::new(),
            anomalies_detected: 0,
            high_significance: 0,
            potential_incidents: 0,
            performance_degradation: "none".into(),
            capacity_concern: "none".into(),
            security_concern: "none".into(),
            cost_opportunity_usd: 0.0,
            recommended_actions: vec!["Connect a project or agent to begin.".into()],
        },
        system_overview: SystemOverview {
            health: 1.0,
            entities: 0,
            active_incidents: 0,
            open_actions: 0,
            meaningful_changes_24h: 0,
            related_to_degradation: 0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_production_store() {
        let store = Store::empty();
        assert!(store.entities().is_empty());
        assert_eq!(store.overview().entities, 0);
        assert!(store.snapshot().incidents.is_empty());
    }

    #[test]
    fn upsert_entity() {
        let store = Store::empty();
        store.upsert_entity(Entity {
            id: "svc:api".into(),
            kind: "service".into(),
            name: "api".into(),
            health: 0.9,
            labels: HashMap::new(),
            attributes: HashMap::new(),
        });
        assert_eq!(store.entities().len(), 1);
        assert!(store.entity("svc:api").is_some());
    }
}
