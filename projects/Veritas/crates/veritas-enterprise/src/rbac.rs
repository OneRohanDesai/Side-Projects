//! Role based access control.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Intelligence
    ReadIntelligence,
    WriteIntelligence,
    // Telemetry / analytics
    ReadTelemetry,
    WriteTelemetry,
    ReadAnalytics,
    RunSql,
    // Graph
    ReadGraph,
    // AI
    UseAi,
    // Enterprise
    ManageUsers,
    ManageRoles,
    ManageLicense,
    ManageFleet,
    ManagePacks,
    ManageHa,
    ReadAudit,
    // Admin
    AdminAll,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::ReadIntelligence => "read_intelligence",
            Permission::WriteIntelligence => "write_intelligence",
            Permission::ReadTelemetry => "read_telemetry",
            Permission::WriteTelemetry => "write_telemetry",
            Permission::ReadAnalytics => "read_analytics",
            Permission::RunSql => "run_sql",
            Permission::ReadGraph => "read_graph",
            Permission::UseAi => "use_ai",
            Permission::ManageUsers => "manage_users",
            Permission::ManageRoles => "manage_roles",
            Permission::ManageLicense => "manage_license",
            Permission::ManageFleet => "manage_fleet",
            Permission::ManagePacks => "manage_packs",
            Permission::ManageHa => "manage_ha",
            Permission::ReadAudit => "read_audit",
            Permission::AdminAll => "admin_all",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub description: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct RbacService {
    roles: HashMap<String, Role>,
    /// user_id → role ids
    assignments: HashMap<String, HashSet<String>>,
}

impl RbacService {
    pub fn bootstrap() -> Self {
        let mut s = Self::default();
        s.upsert_role(Role {
            id: "role:viewer".into(),
            name: "Viewer".into(),
            description: "Read only intelligence and telemetry".into(),
            permissions: vec![
                Permission::ReadIntelligence.as_str().into(),
                Permission::ReadTelemetry.as_str().into(),
                Permission::ReadAnalytics.as_str().into(),
                Permission::ReadGraph.as_str().into(),
            ],
        });
        s.upsert_role(Role {
            id: "role:sre".into(),
            name: "SRE".into(),
            description: "Operate investigations, SQL, AI, fleet view".into(),
            permissions: vec![
                Permission::ReadIntelligence.as_str().into(),
                Permission::WriteIntelligence.as_str().into(),
                Permission::ReadTelemetry.as_str().into(),
                Permission::WriteTelemetry.as_str().into(),
                Permission::ReadAnalytics.as_str().into(),
                Permission::RunSql.as_str().into(),
                Permission::ReadGraph.as_str().into(),
                Permission::UseAi.as_str().into(),
                Permission::ManageFleet.as_str().into(),
                Permission::ReadAudit.as_str().into(),
            ],
        });
        s.upsert_role(Role {
            id: "role:admin".into(),
            name: "Admin".into(),
            description: "Full enterprise control".into(),
            permissions: vec![Permission::AdminAll.as_str().into()],
        });
        s.assign("user:admin", "role:admin");
        s.assign("user:sre", "role:sre");
        s.assign("user:viewer", "role:viewer");
        s
    }

    pub fn upsert_role(&mut self, role: Role) {
        self.roles.insert(role.id.clone(), role);
    }

    pub fn assign(&mut self, user_id: &str, role_id: &str) {
        self.assignments
            .entry(user_id.into())
            .or_default()
            .insert(role_id.into());
    }

    pub fn roles(&self) -> Vec<Role> {
        let mut v: Vec<_> = self.roles.values().cloned().collect();
        v.sort_by(|a, b| a.id.cmp(&b.id));
        v
    }

    pub fn role_count(&self) -> usize {
        self.roles.len()
    }

    pub fn permissions_for_user(&self, user_id: &str) -> HashSet<String> {
        let mut perms = HashSet::new();
        if let Some(roles) = self.assignments.get(user_id) {
            for rid in roles {
                if let Some(role) = self.roles.get(rid) {
                    for p in &role.permissions {
                        perms.insert(p.clone());
                    }
                }
            }
        }
        perms
    }

    pub fn can(&self, user_id: &str, permission: &str) -> bool {
        let perms = self.permissions_for_user(user_id);
        perms.contains(Permission::AdminAll.as_str()) || perms.contains(permission)
    }

    pub fn assignments(&self) -> HashMap<String, Vec<String>> {
        self.assignments
            .iter()
            .map(|(k, v)| {
                let mut roles: Vec<_> = v.iter().cloned().collect();
                roles.sort();
                (k.clone(), roles)
            })
            .collect()
    }
}
