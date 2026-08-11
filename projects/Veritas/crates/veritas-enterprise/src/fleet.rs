//! Agent fleet registry and heartbeat.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHeartbeat {
    pub agent_id: String,
    pub host: String,
    pub version: String,
    pub status: String,
    #[serde(default)]
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FleetAgent {
    pub agent_id: String,
    pub host: String,
    pub version: String,
    pub status: String,
    pub labels: HashMap<String, String>,
    pub last_seen: DateTime<Utc>,
    pub online: bool,
    pub registered_at: DateTime<Utc>,
}

#[derive(Debug, Default)]
pub struct FleetRegistry {
    agents: HashMap<String, FleetAgent>,
}

impl FleetRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn heartbeat(&mut self, hb: AgentHeartbeat) -> FleetAgent {
        let now = Utc::now();
        let entry = self
            .agents
            .entry(hb.agent_id.clone())
            .or_insert_with(|| FleetAgent {
                agent_id: hb.agent_id.clone(),
                host: hb.host.clone(),
                version: hb.version.clone(),
                status: hb.status.clone(),
                labels: hb.labels.clone(),
                last_seen: now,
                online: true,
                registered_at: now,
            });
        entry.host = hb.host;
        entry.version = hb.version;
        entry.status = hb.status;
        entry.labels = hb.labels;
        entry.last_seen = now;
        entry.online = true;
        entry.clone()
    }

    pub fn refresh_online(&mut self) {
        let cutoff = Utc::now() - Duration::seconds(90);
        for a in self.agents.values_mut() {
            a.online = a.last_seen >= cutoff;
            if !a.online && a.status == "ready" {
                a.status = "stale".into();
            }
        }
    }

    pub fn list(&mut self) -> Vec<FleetAgent> {
        self.refresh_online();
        let mut v: Vec<_> = self.agents.values().cloned().collect();
        v.sort_by(|a, b| a.agent_id.cmp(&b.agent_id));
        v
    }

    pub fn agent_count(&self) -> usize {
        self.agents.len()
    }

    pub fn online_count(&mut self) -> usize {
        self.refresh_online();
        self.agents.values().filter(|a| a.online).count()
    }

    pub fn remove(&mut self, agent_id: &str) -> bool {
        self.agents.remove(agent_id).is_some()
    }
}
