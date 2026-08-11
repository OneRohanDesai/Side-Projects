//! High availability cluster view (local appliance + multi node ready).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HaNode {
    pub id: String,
    pub address: String,
    pub role: String,
    pub healthy: bool,
    pub last_heartbeat: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HaCluster {
    pub cluster_id: String,
    pub mode: String,
    pub leader: String,
    pub quorum: u32,
    pub nodes: Vec<HaNode>,
    pub replication: String,
    pub notes: Vec<String>,
}

impl HaCluster {
    pub fn local_single_node() -> Self {
        let id = format!("node:{}", hostname_fallback());
        Self {
            cluster_id: format!("cluster:{}", Uuid::new_v4()),
            mode: "single".into(),
            leader: id.clone(),
            quorum: 1,
            nodes: vec![HaNode {
                id: id.clone(),
                address: "127.0.0.1:7420".into(),
                role: "leader".into(),
                healthy: true,
                last_heartbeat: Utc::now(),
            }],
            replication: "local duckdb + parquet · optional peer sync".into(),
            notes: vec![
                "Single node local first default.".into(),
                "Enterprise HA: promote standby with shared license and fleet join.".into(),
            ],
        }
    }

    pub fn enable_ha_pair(&mut self, peer_address: &str) {
        self.mode = "active_standby".into();
        self.quorum = 2;
        let peer_id = format!("node:peer-{}", self.nodes.len() + 1);
        self.nodes.push(HaNode {
            id: peer_id,
            address: peer_address.into(),
            role: "standby".into(),
            healthy: false,
            last_heartbeat: Utc::now(),
        });
        self.notes.push(format!("Standby configured at {peer_address}"));
        self.replication = "async WAL ship · standby promote on leader loss".into();
    }

    pub fn status(&self) -> HaCluster {
        self.clone()
    }
}

fn hostname_fallback() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_else(|_| "local".into())
}
