//! Phase 7 enterprise platform services.
//!
//! SSO / OIDC config · local auth · RBAC · audit · fleet · HA · signed packs.

mod audit;
mod auth;
mod fleet;
mod ha;
mod packs;
mod rbac;

pub use audit::*;
pub use auth::*;
pub use fleet::*;
pub use ha::*;
pub use packs::*;
pub use rbac::*;

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// In-memory enterprise control plane state (local first appliance).
#[derive(Clone)]
pub struct EnterpriseState {
    pub auth: Arc<Mutex<AuthService>>,
    pub rbac: Arc<Mutex<RbacService>>,
    pub audit: Arc<Mutex<AuditLog>>,
    pub fleet: Arc<Mutex<FleetRegistry>>,
    pub ha: Arc<Mutex<HaCluster>>,
    pub packs: Arc<Mutex<PackRegistry>>,
}

impl EnterpriseState {
    pub fn bootstrap() -> Self {
        let rbac = RbacService::bootstrap();
        let auth = AuthService::bootstrap(&rbac);
        let audit = AuditLog::new();
        audit.record(
            "system",
            "bootstrap",
            "enterprise",
            "Phase 7 enterprise plane started",
            true,
        );
        let fleet = FleetRegistry::new();
        let ha = HaCluster::local_single_node();
        let packs = PackRegistry::bootstrap();

        Self {
            auth: Arc::new(Mutex::new(auth)),
            rbac: Arc::new(Mutex::new(rbac)),
            audit: Arc::new(Mutex::new(audit)),
            fleet: Arc::new(Mutex::new(fleet)),
            ha: Arc::new(Mutex::new(ha)),
            packs: Arc::new(Mutex::new(packs)),
        }
    }

    pub fn overview(&self) -> EnterpriseOverview {
        let auth = self.auth.lock().unwrap();
        let rbac = self.rbac.lock().unwrap();
        let audit = self.audit.lock().unwrap();
        let mut fleet = self.fleet.lock().unwrap();
        let ha = self.ha.lock().unwrap();
        let packs = self.packs.lock().unwrap();
        EnterpriseOverview {
            users: auth.user_count(),
            roles: rbac.role_count(),
            sessions: auth.session_count(),
            audit_events: audit.len(),
            agents: fleet.agent_count(),
            agents_online: fleet.online_count(),
            ha_mode: ha.mode.clone(),
            ha_nodes: ha.nodes.len(),
            packs: packs.list().len(),
            sso_providers: auth.sso_providers().len(),
            air_gap_ready: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnterpriseOverview {
    pub users: usize,
    pub roles: usize,
    pub sessions: usize,
    pub audit_events: usize,
    pub agents: usize,
    pub agents_online: usize,
    pub ha_mode: String,
    pub ha_nodes: usize,
    pub packs: usize,
    pub sso_providers: usize,
    pub air_gap_ready: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enterprise_bootstrap() {
        let ent = EnterpriseState::bootstrap();
        let ov = ent.overview();
        assert!(ov.users >= 1);
        assert!(ov.roles >= 3);
        assert!(ov.air_gap_ready);

        // login admin
        let mut auth = ent.auth.lock().unwrap();
        let sess = auth
            .login_local("admin", "veritas-admin")
            .expect("admin login");
        assert!(!sess.token.is_empty());
        drop(auth);

        ent.audit.lock().unwrap().record(
            "admin",
            "login",
            "auth",
            "local login ok",
            true,
        );
        assert!(ent.audit.lock().unwrap().len() >= 2);

        // fleet heartbeat
        let mut fleet = ent.fleet.lock().unwrap();
        fleet.heartbeat(AgentHeartbeat {
            agent_id: "agent:test".into(),
            host: "test-host".into(),
            version: "0.7.0".into(),
            status: "ready".into(),
            labels: Default::default(),
        });
        assert_eq!(fleet.agent_count(), 1);
    }
}
