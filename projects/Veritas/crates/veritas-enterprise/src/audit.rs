//! Tamper-evident style audit log (append only in process; hash chain).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub at: DateTime<Utc>,
    pub actor: String,
    pub action: String,
    pub resource: String,
    pub detail: String,
    pub success: bool,
    pub prev_hash: String,
    pub hash: String,
}

#[derive(Debug, Default)]
pub struct AuditLog {
    events: Mutex<Vec<AuditEvent>>,
}

impl AuditLog {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(
        &self,
        actor: &str,
        action: &str,
        resource: &str,
        detail: &str,
        success: bool,
    ) -> AuditEvent {
        let mut guard = self.events.lock().unwrap();
        let prev_hash = guard
            .last()
            .map(|e| e.hash.clone())
            .unwrap_or_else(|| "genesis".into());
        let id = format!("aud:{}", Uuid::new_v4());
        let at = Utc::now();
        let payload = format!(
            "{id}|{at}|{actor}|{action}|{resource}|{detail}|{success}|{prev_hash}"
        );
        let mut h = Sha256::new();
        h.update(payload.as_bytes());
        let hash = hex::encode(h.finalize());
        let ev = AuditEvent {
            id,
            at,
            actor: actor.into(),
            action: action.into(),
            resource: resource.into(),
            detail: detail.into(),
            success,
            prev_hash,
            hash,
        };
        guard.push(ev.clone());
        // ring buffer
        if guard.len() > 10_000 {
            let drain = guard.len() - 10_000;
            guard.drain(0..drain);
        }
        ev
    }

    pub fn list(&self, limit: usize) -> Vec<AuditEvent> {
        let guard = self.events.lock().unwrap();
        guard.iter().rev().take(limit).cloned().collect()
    }

    pub fn len(&self) -> usize {
        self.events.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn verify_chain(&self) -> bool {
        let guard = self.events.lock().unwrap();
        let mut prev = "genesis".to_string();
        for e in guard.iter() {
            if e.prev_hash != prev {
                return false;
            }
            let payload = format!(
                "{}|{}|{}|{}|{}|{}|{}|{}",
                e.id, e.at, e.actor, e.action, e.resource, e.detail, e.success, e.prev_hash
            );
            let mut h = Sha256::new();
            h.update(payload.as_bytes());
            if hex::encode(h.finalize()) != e.hash {
                return false;
            }
            prev = e.hash.clone();
        }
        true
    }
}
