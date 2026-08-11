//! License entitlements · offline signed files · enterprise.
//!
//! Private signing key never ships. Demo uses deterministic seed for local verify.

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Edition {
    Free,
    Pro,
    Enterprise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entitlement {
    pub customer_id: String,
    pub license_id: String,
    pub edition: Edition,
    pub expiry: DateTime<Utc>,
    pub max_seats: u32,
    pub max_nodes: u32,
    pub max_agents: u32,
    pub max_storage_gb: u32,
    pub enabled_modules: Vec<String>,
    pub ai_features: String,
    pub support_level: String,
    /// ed25519 signature hex over canonical payload (without signature field)
    pub signature: String,
    #[serde(default)]
    pub offline: bool,
    #[serde(default)]
    pub machine_fingerprint: Option<String>,
}

impl Entitlement {
    pub fn free_dev() -> Self {
        Self {
            customer_id: "dev-local".into(),
            license_id: "lic-free-dev".into(),
            edition: Edition::Free,
            expiry: Utc::now() + Duration::days(3650),
            max_seats: 1,
            max_nodes: 3,
            max_agents: 3,
            max_storage_gb: 10,
            enabled_modules: vec![
                "what_changed".into(),
                "why_basic".into(),
                "forecast_basic".into(),
                "archaeology_7d".into(),
                "daily_report".into(),
                "graph".into(),
            ],
            ai_features: "local_basic_optional".into(),
            support_level: "community".into(),
            signature: "unsigned-dev".into(),
            offline: true,
            machine_fingerprint: None,
        }
    }

    pub fn enterprise_template(customer_id: &str, fingerprint: Option<String>) -> Self {
        Self {
            customer_id: customer_id.into(),
            license_id: format!("lic-ent-{}", chrono::Utc::now().timestamp()),
            edition: Edition::Enterprise,
            expiry: Utc::now() + Duration::days(365),
            max_seats: 100,
            max_nodes: 10_000,
            max_agents: 10_000,
            max_storage_gb: 100_000,
            enabled_modules: vec![
                "all".into(),
                "sso".into(),
                "rbac".into(),
                "audit".into(),
                "fleet".into(),
                "ha".into(),
                "packs".into(),
                "offline_license".into(),
            ],
            ai_features: "local_and_private_endpoint".into(),
            support_level: "premium".into(),
            signature: String::new(),
            offline: true,
            machine_fingerprint: fingerprint,
        }
    }

    pub fn allows(&self, module: &str) -> bool {
        if !self.valid_time() {
            return false;
        }
        self.enabled_modules.iter().any(|m| m == module || m == "all")
            || matches!(self.edition, Edition::Pro | Edition::Enterprise)
    }

    pub fn valid_time(&self) -> bool {
        self.expiry > Utc::now()
    }

    pub fn canonical_bytes(&self) -> Result<Vec<u8>> {
        let mut clone = self.clone();
        clone.signature = String::new();
        Ok(serde_json::to_vec(&clone)?)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatus {
    pub valid: bool,
    pub entitlement: Entitlement,
    pub air_gap_ready: bool,
    pub message: String,
    pub offline_file: Option<String>,
    pub machine_fingerprint: String,
    pub verifying_key_hex: String,
}

pub struct LicenseService {
    verifying_key: VerifyingKey,
    /// Dev only: mint offline licenses
    signing_key: Option<SigningKey>,
    current: Mutex<Entitlement>,
    offline_path: Option<PathBuf>,
}

impl LicenseService {
    pub fn bootstrap() -> Self {
        let seed = Sha256::digest(b"veritas-phase7-license-demo-seed");
        let mut seed_arr = [0u8; 32];
        seed_arr.copy_from_slice(&seed);
        let signing = SigningKey::from_bytes(&seed_arr);
        let verifying = signing.verifying_key();
        Self {
            verifying_key: verifying,
            signing_key: Some(signing),
            current: Mutex::new(Entitlement::free_dev()),
            offline_path: None,
        }
    }

    pub fn machine_fingerprint() -> String {
        let host = std::env::var("HOSTNAME")
            .or_else(|_| std::env::var("HOST"))
            .unwrap_or_else(|_| "local".into());
        let mut h = Sha256::new();
        h.update(b"veritas-machine:");
        h.update(host.as_bytes());
        if let Ok(home) = std::env::var("HOME") {
            h.update(home.as_bytes());
        }
        hex::encode(h.finalize())[..16].to_string()
    }

    pub fn verifying_key_hex(&self) -> String {
        hex::encode(self.verifying_key.as_bytes())
    }

    pub fn status(&self) -> LicenseStatus {
        let ent = self.current.lock().unwrap().clone();
        let valid = ent.valid_time()
            && (ent.signature == "unsigned-dev" || self.verify_entitlement(&ent).unwrap_or(false));
        let fp = Self::machine_fingerprint();
        let bound_ok = match &ent.machine_fingerprint {
            Some(m) if !m.is_empty() => m == &fp,
            _ => true,
        };
        let valid = valid && bound_ok;
        LicenseStatus {
            valid,
            air_gap_ready: ent.offline || matches!(ent.edition, Edition::Enterprise),
            message: if valid {
                format!("{:?} entitlement active", ent.edition)
            } else if !bound_ok {
                "License machine fingerprint mismatch".into()
            } else {
                "License invalid or expired".into()
            },
            entitlement: ent,
            offline_file: self
                .offline_path
                .as_ref()
                .map(|p| p.display().to_string()),
            machine_fingerprint: fp,
            verifying_key_hex: self.verifying_key_hex(),
        }
    }

    pub fn verify_entitlement(&self, ent: &Entitlement) -> Result<bool> {
        if ent.signature == "unsigned-dev" {
            return Ok(true);
        }
        let bytes = ent.canonical_bytes()?;
        let hash = Sha256::digest(&bytes);
        let sig_bytes = hex::decode(&ent.signature).context("sig hex")?;
        if sig_bytes.len() != 64 {
            bail!("bad sig len");
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&arr);
        Ok(self.verifying_key.verify(&hash, &sig).is_ok())
    }

    pub fn sign_entitlement(&self, mut ent: Entitlement) -> Result<Entitlement> {
        let signing = self
            .signing_key
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("no signing key"))?;
        ent.signature = String::new();
        let bytes = ent.canonical_bytes()?;
        let hash = Sha256::digest(&bytes);
        let sig = signing.sign(&hash);
        ent.signature = hex::encode(sig.to_bytes());
        Ok(ent)
    }

    pub fn install_offline_json(&self, json: &str) -> Result<LicenseStatus> {
        let ent: Entitlement = serde_json::from_str(json).context("parse license json")?;
        if !self.verify_entitlement(&ent)? {
            bail!("signature verification failed");
        }
        if !ent.valid_time() {
            bail!("license expired");
        }
        if let Some(ref fp) = ent.machine_fingerprint {
            if !fp.is_empty() && fp != &Self::machine_fingerprint() {
                bail!("machine fingerprint mismatch");
            }
        }
        *self.current.lock().unwrap() = ent;
        Ok(self.status())
    }

    pub fn install_offline_file(&mut self, path: &Path) -> Result<LicenseStatus> {
        let raw = std::fs::read_to_string(path).context("read license file")?;
        let st = self.install_offline_json(&raw)?;
        self.offline_path = Some(path.to_path_buf());
        Ok(st)
    }

    pub fn mint_enterprise_offline(&self, customer_id: &str, bind_machine: bool) -> Result<Entitlement> {
        let fp = if bind_machine {
            Some(Self::machine_fingerprint())
        } else {
            None
        };
        let ent = Entitlement::enterprise_template(customer_id, fp);
        self.sign_entitlement(ent)
    }

    pub fn current(&self) -> Entitlement {
        self.current.lock().unwrap().clone()
    }
}

pub fn current_status() -> LicenseStatus {
    // Back-compat for early callers
    LicenseService::bootstrap().status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_allows_core_modules() {
        let e = Entitlement::free_dev();
        assert!(e.allows("what_changed"));
        assert_eq!(e.edition, Edition::Free);
    }

    #[test]
    fn offline_enterprise_roundtrip() {
        let svc = LicenseService::bootstrap();
        let ent = svc.mint_enterprise_offline("acme", true).unwrap();
        assert!(svc.verify_entitlement(&ent).unwrap());
        let json = serde_json::to_string_pretty(&ent).unwrap();
        let st = svc.install_offline_json(&json).unwrap();
        assert!(st.valid);
        assert_eq!(st.entitlement.edition, Edition::Enterprise);
    }
}
