//! Local authentication + SSO/OIDC provider configuration.

use crate::rbac::RbacService;
use anyhow::{bail, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub active: bool,
    pub auth_source: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    pub username: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoProvider {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub enabled: bool,
    pub issuer: String,
    pub client_id: String,
    pub scopes: Vec<String>,
    pub discovery_url: String,
    /// Redirect for OIDC authorization code flow (configured, not executed in appliance demo).
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Default)]
pub struct AuthService {
    users: HashMap<String, User>,
    /// token → session
    sessions: HashMap<String, Session>,
    sso: Vec<SsoProvider>,
}

impl AuthService {
    pub fn bootstrap(rbac: &RbacService) -> Self {
        let mut s = Self::default();
        s.upsert_user(User {
            id: "user:admin".into(),
            username: "admin".into(),
            display_name: "VERITAS Admin".into(),
            email: "admin@veritas.local".into(),
            active: true,
            auth_source: "local".into(),
            password_hash: hash_password("veritas-admin"),
        });
        s.upsert_user(User {
            id: "user:sre".into(),
            username: "sre".into(),
            display_name: "SRE Operator".into(),
            email: "sre@veritas.local".into(),
            active: true,
            auth_source: "local".into(),
            password_hash: hash_password("veritas-sre"),
        });
        s.upsert_user(User {
            id: "user:viewer".into(),
            username: "viewer".into(),
            display_name: "Read Only".into(),
            email: "viewer@veritas.local".into(),
            active: true,
            auth_source: "local".into(),
            password_hash: hash_password("veritas-viewer"),
        });

        s.sso = vec![
            SsoProvider {
                id: "sso:oidc-corp".into(),
                name: "Corporate OIDC".into(),
                protocol: "oidc".into(),
                enabled: false,
                issuer: "https://sso.example.com".into(),
                client_id: "veritas-enterprise".into(),
                scopes: vec!["openid".into(), "profile".into(), "email".into()],
                discovery_url: "https://sso.example.com/.well-known/openid-configuration".into(),
                redirect_uri: "http://127.0.0.1:7420/v1/auth/oidc/callback".into(),
            },
            SsoProvider {
                id: "sso:ldap".into(),
                name: "LDAP / Active Directory".into(),
                protocol: "ldap".into(),
                enabled: false,
                issuer: "ldap://ldap.example.com".into(),
                client_id: "cn=veritas,ou=apps".into(),
                scopes: vec!["uid".into(), "memberOf".into()],
                discovery_url: "".into(),
                redirect_uri: "".into(),
            },
        ];

        // warm nothing from rbac yet; sessions attach roles at login
        let _ = rbac;
        s
    }

    pub fn upsert_user(&mut self, user: User) {
        self.users.insert(user.username.clone(), user);
    }

    pub fn users_public(&self) -> Vec<UserPublic> {
        let mut v: Vec<_> = self
            .users
            .values()
            .map(|u| UserPublic {
                id: u.id.clone(),
                username: u.username.clone(),
                display_name: u.display_name.clone(),
                email: u.email.clone(),
                active: u.active,
                auth_source: u.auth_source.clone(),
            })
            .collect();
        v.sort_by(|a, b| a.username.cmp(&b.username));
        v
    }

    pub fn user_count(&self) -> usize {
        self.users.len()
    }

    pub fn session_count(&self) -> usize {
        self.sessions
            .values()
            .filter(|s| s.expires_at > Utc::now())
            .count()
    }

    pub fn sso_providers(&self) -> &[SsoProvider] {
        &self.sso
    }

    pub fn set_sso_enabled(&mut self, id: &str, enabled: bool) -> Result<()> {
        let p = self
            .sso
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("provider not found"))?;
        p.enabled = enabled;
        Ok(())
    }

    pub fn login_local(&mut self, username: &str, password: &str) -> Result<Session> {
        let user = self
            .users
            .get(username)
            .ok_or_else(|| anyhow::anyhow!("invalid credentials"))?;
        if !user.active {
            bail!("user inactive");
        }
        if user.password_hash != hash_password(password) {
            bail!("invalid credentials");
        }
        let user_id = user.id.clone();
        let username = user.username.clone();
        self.issue_session(&user_id, &username, None)
    }

    /// OIDC callback simulation for enterprise demos (maps external subject to local user).
    pub fn login_oidc_map(&mut self, provider_id: &str, subject_email: &str) -> Result<Session> {
        let provider = self
            .sso
            .iter()
            .find(|p| p.id == provider_id)
            .ok_or_else(|| anyhow::anyhow!("unknown provider"))?;
        if !provider.enabled {
            bail!("SSO provider disabled. Enable under enterprise SSO settings.");
        }
        let user = self
            .users
            .values()
            .find(|u| u.email == subject_email)
            .ok_or_else(|| anyhow::anyhow!("no local user mapped for SSO subject"))?;
        let user_id = user.id.clone();
        let username = user.username.clone();
        self.issue_session(&user_id, &username, Some(provider_id.to_string()))
    }

    fn issue_session(
        &mut self,
        user_id: &str,
        username: &str,
        _sso: Option<String>,
    ) -> Result<Session> {
        // roles resolved at API layer with rbac; store placeholder
        let token = format!("vtx_{}", Uuid::new_v4());
        let sess = Session {
            token: token.clone(),
            user_id: user_id.into(),
            username: username.into(),
            roles: vec![],
            permissions: vec![],
            expires_at: Utc::now() + Duration::hours(12),
            created_at: Utc::now(),
        };
        self.sessions.insert(token, sess.clone());
        Ok(sess)
    }

    pub fn enrich_session(&mut self, token: &str, rbac: &RbacService) -> Option<Session> {
        let sess = self.sessions.get_mut(token)?;
        if sess.expires_at <= Utc::now() {
            return None;
        }
        let roles = rbac
            .assignments()
            .get(&sess.user_id)
            .cloned()
            .unwrap_or_default();
        let mut perms: Vec<_> = rbac.permissions_for_user(&sess.user_id).into_iter().collect();
        perms.sort();
        sess.roles = roles;
        sess.permissions = perms;
        Some(sess.clone())
    }

    pub fn validate(&mut self, token: &str, rbac: &RbacService) -> Option<Session> {
        self.enrich_session(token, rbac)
    }

    pub fn logout(&mut self, token: &str) -> bool {
        self.sessions.remove(token).is_some()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub active: bool,
    pub auth_source: String,
}

pub fn hash_password(password: &str) -> String {
    let mut h = Sha256::new();
    h.update(b"veritas-v1:");
    h.update(password.as_bytes());
    hex::encode(h.finalize())
}
