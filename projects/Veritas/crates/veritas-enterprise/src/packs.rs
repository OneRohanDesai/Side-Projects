//! Signed intelligence / plugin packs.

use anyhow::{bail, Result};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

/// Demo vendor keypair generated once at bootstrap for local verification.
/// Production: only verifying key ships; signing stays on license server.
#[derive(Clone)]
pub struct PackRegistry {
    verifying_key: VerifyingKey,
    /// Only present in dev/bootstrap to mint demo packs.
    signing_key: Option<SigningKey>,
    packs: HashMap<String, SignedPack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub kind: String,
    pub edition: String,
    pub modules: Vec<String>,
    pub description: String,
    pub issued_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedPack {
    pub manifest: PackManifest,
    /// hex sha256 of canonical manifest json
    pub content_hash: String,
    /// hex ed25519 signature over content_hash bytes
    pub signature: String,
    pub verified: bool,
    pub installed: bool,
}

impl PackRegistry {
    pub fn bootstrap() -> Self {
        // Deterministic demo seed (not for production secrecy)
        let seed = Sha256::digest(b"veritas-phase7-pack-demo-seed");
        let mut seed_arr = [0u8; 32];
        seed_arr.copy_from_slice(&seed);
        let signing = SigningKey::from_bytes(&seed_arr);
        let verifying = signing.verifying_key();
        let mut reg = Self {
            verifying_key: verifying,
            signing_key: Some(signing),
            packs: HashMap::new(),
        };
        let _ = reg.install_demo_pack(
            "pack:detection-core",
            "Detection Core",
            "1.0.0",
            "detection",
            vec!["anomaly_rules".into(), "latency_cascade".into()],
            "Core detection rules for change correlated incidents",
        );
        let _ = reg.install_demo_pack(
            "pack:capacity",
            "Capacity Intelligence",
            "1.0.0",
            "analysis",
            vec!["forecast_packs".into(), "saturation".into()],
            "Capacity forecasting rule pack",
        );
        reg
    }

    pub fn verifying_key_hex(&self) -> String {
        hex::encode(self.verifying_key.as_bytes())
    }

    fn install_demo_pack(
        &mut self,
        id: &str,
        name: &str,
        version: &str,
        kind: &str,
        modules: Vec<String>,
        description: &str,
    ) -> Result<()> {
        let manifest = PackManifest {
            id: id.into(),
            name: name.into(),
            version: version.into(),
            kind: kind.into(),
            edition: "enterprise".into(),
            modules,
            description: description.into(),
            issued_at: Utc::now(),
        };
        let pack = self.sign_manifest(manifest)?;
        self.packs.insert(pack.manifest.id.clone(), pack);
        Ok(())
    }

    pub fn sign_manifest(&self, manifest: PackManifest) -> Result<SignedPack> {
        let signing = self
            .signing_key
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("no signing key in this build"))?;
        let canonical = serde_json::to_vec(&manifest)?;
        let content_hash = hex::encode(Sha256::digest(&canonical));
        let sig = signing.sign(content_hash.as_bytes());
        Ok(SignedPack {
            manifest,
            content_hash,
            signature: hex::encode(sig.to_bytes()),
            verified: true,
            installed: true,
        })
    }

    pub fn verify_and_install(&mut self, mut pack: SignedPack) -> Result<SignedPack> {
        let canonical = serde_json::to_vec(&pack.manifest)?;
        let expect_hash = hex::encode(Sha256::digest(&canonical));
        if expect_hash != pack.content_hash {
            bail!("content hash mismatch");
        }
        let sig_bytes = hex::decode(&pack.signature)?;
        if sig_bytes.len() != 64 {
            bail!("bad signature length");
        }
        let mut arr = [0u8; 64];
        arr.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&arr);
        self.verifying_key
            .verify(pack.content_hash.as_bytes(), &sig)
            .map_err(|_| anyhow::anyhow!("signature verification failed"))?;
        pack.verified = true;
        pack.installed = true;
        self.packs.insert(pack.manifest.id.clone(), pack.clone());
        Ok(pack)
    }

    pub fn list(&self) -> Vec<SignedPack> {
        let mut v: Vec<_> = self.packs.values().cloned().collect();
        v.sort_by(|a, b| a.manifest.id.cmp(&b.manifest.id));
        v
    }

    pub fn uninstall(&mut self, id: &str) -> bool {
        self.packs.remove(id).is_some()
    }

    pub fn mint_custom(&mut self, name: &str, kind: &str, modules: Vec<String>) -> Result<SignedPack> {
        let id = format!("pack:{}", Uuid::new_v4());
        let manifest = PackManifest {
            id: id.clone(),
            name: name.into(),
            version: "0.1.0".into(),
            kind: kind.into(),
            edition: "enterprise".into(),
            modules,
            description: "Custom signed pack".into(),
            issued_at: Utc::now(),
        };
        let pack = self.sign_manifest(manifest)?;
        self.packs.insert(id, pack.clone());
        Ok(pack)
    }
}
