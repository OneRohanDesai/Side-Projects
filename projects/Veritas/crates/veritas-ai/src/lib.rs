//! Phase 6 AI layer.
//!
//! Facts are computed by analytics/intelligence. AI only explains.
//! Modes: off · deterministic (always) · local (Ollama) · cloud (optional).

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use veritas_core::{Explanation, ExplanationSection, FactBundle};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AiMode {
    Off,
    Deterministic,
    Local,
    Cloud,
}

impl AiMode {
    pub fn from_env() -> Self {
        match std::env::var("VERITAS_AI_MODE")
            .unwrap_or_else(|_| "deterministic".into())
            .to_lowercase()
            .as_str()
        {
            "off" | "none" => AiMode::Off,
            "local" | "ollama" => AiMode::Local,
            "cloud" => AiMode::Cloud,
            _ => AiMode::Deterministic,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStatus {
    pub mode: AiMode,
    pub available_modes: Vec<String>,
    pub local_endpoint: String,
    pub local_reachable: bool,
    pub cloud_configured: bool,
    pub principle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainRequest {
    pub facts: FactBundle,
    /// Optional override: deterministic | local | cloud
    pub mode: Option<String>,
}

#[derive(Clone)]
pub struct AiEngine {
    mode: AiMode,
    local_endpoint: String,
    cloud_endpoint: Option<String>,
    cloud_api_key: Option<String>,
    http: reqwest::Client,
}

impl AiEngine {
    pub fn from_env() -> Self {
        let local_endpoint = std::env::var("VERITAS_OLLAMA_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:11434".into());
        let cloud_endpoint = std::env::var("VERITAS_CLOUD_AI_URL").ok();
        let cloud_api_key = std::env::var("VERITAS_CLOUD_AI_KEY").ok();
        Self {
            mode: AiMode::from_env(),
            local_endpoint,
            cloud_endpoint,
            cloud_api_key,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(8))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn with_mode(mut self, mode: AiMode) -> Self {
        self.mode = mode;
        self
    }

    pub async fn status(&self) -> AiStatus {
        let local_reachable = self.probe_local().await;
        AiStatus {
            mode: self.mode,
            available_modes: vec![
                "off".into(),
                "deterministic".into(),
                "local".into(),
                "cloud".into(),
            ],
            local_endpoint: self.local_endpoint.clone(),
            local_reachable,
            cloud_configured: self.cloud_endpoint.is_some() && self.cloud_api_key.is_some(),
            principle: "Facts from the analytical engine. Language models only explain."
                .into(),
        }
    }

    async fn probe_local(&self) -> bool {
        let url = format!("{}/api/tags", self.local_endpoint.trim_end_matches('/'));
        self.http.get(url).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }

    pub async fn explain(&self, req: ExplainRequest) -> Result<Explanation> {
        let mode = match req.mode.as_deref().map(|s| s.to_lowercase()) {
            Some(ref s) if s == "off" => AiMode::Off,
            Some(ref s) if s == "local" || s == "ollama" => AiMode::Local,
            Some(ref s) if s == "cloud" => AiMode::Cloud,
            Some(ref s) if s == "deterministic" => AiMode::Deterministic,
            _ => self.mode,
        };

        match mode {
            AiMode::Off => Ok(Explanation {
                mode: "off".into(),
                title: "AI disabled".into(),
                summary: "Use deterministic intelligence products directly. AI explanation is off."
                    .into(),
                sections: vec![],
                caveats: vec!["Set VERITAS_AI_MODE=deterministic|local|cloud to enable.".into()],
                facts_id: req.facts.id.clone(),
                model: None,
            }),
            AiMode::Deterministic => Ok(deterministic_explain(&req.facts)),
            AiMode::Local => match self.explain_local(&req.facts).await {
                Ok(e) => Ok(e),
                Err(err) => {
                    tracing::warn!(error = %err, "local AI failed; falling back to deterministic");
                    let mut e = deterministic_explain(&req.facts);
                    e.mode = "deterministic_fallback".into();
                    e.caveats.push(format!("Local model unavailable: {err}"));
                    Ok(e)
                }
            },
            AiMode::Cloud => match self.explain_cloud(&req.facts).await {
                Ok(e) => Ok(e),
                Err(err) => {
                    tracing::warn!(error = %err, "cloud AI failed; falling back to deterministic");
                    let mut e = deterministic_explain(&req.facts);
                    e.mode = "deterministic_fallback".into();
                    e.caveats.push(format!("Cloud model unavailable: {err}"));
                    Ok(e)
                }
            },
        }
    }

    async fn explain_local(&self, facts: &FactBundle) -> Result<Explanation> {
        let url = format!("{}/api/generate", self.local_endpoint.trim_end_matches('/'));
        let model = std::env::var("VERITAS_OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2".into());
        let prompt = build_prompt(facts);
        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
            "options": { "temperature": 0.2 }
        });
        let res = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await
            .context("ollama request")?;
        if !res.status().is_success() {
            bail!("ollama status {}", res.status());
        }
        let v: serde_json::Value = res.json().await.context("ollama json")?;
        let text = v
            .get("response")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if text.is_empty() {
            bail!("empty ollama response");
        }
        Ok(Explanation {
            mode: "local".into(),
            title: format!("Local explanation · {}", facts.kind),
            summary: first_paragraph(&text),
            sections: vec![ExplanationSection {
                heading: "Model narrative".into(),
                body: text,
            }],
            caveats: vec![
                "Narrative from local model over structured facts only.".into(),
                "Numbers and actions still come from the analytical engine.".into(),
            ],
            facts_id: facts.id.clone(),
            model: Some(model),
        })
    }

    async fn explain_cloud(&self, facts: &FactBundle) -> Result<Explanation> {
        let endpoint = self
            .cloud_endpoint
            .as_ref()
            .context("VERITAS_CLOUD_AI_URL not set")?;
        let key = self
            .cloud_api_key
            .as_ref()
            .context("VERITAS_CLOUD_AI_KEY not set")?;
        let prompt = build_prompt(facts);
        // OpenAI-compatible chat completions shape
        let body = serde_json::json!({
            "model": std::env::var("VERITAS_CLOUD_AI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".into()),
            "messages": [
                {"role": "system", "content": "You explain VERITAS structured infrastructure facts. Never invent metrics. Be concise."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        });
        let res = self
            .http
            .post(endpoint)
            .bearer_auth(key)
            .json(&body)
            .send()
            .await
            .context("cloud request")?;
        if !res.status().is_success() {
            bail!("cloud status {}", res.status());
        }
        let v: serde_json::Value = res.json().await.context("cloud json")?;
        let text = v
            .pointer("/choices/0/message/content")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if text.is_empty() {
            bail!("empty cloud response");
        }
        Ok(Explanation {
            mode: "cloud".into(),
            title: format!("Cloud explanation · {}", facts.kind),
            summary: first_paragraph(&text),
            sections: vec![ExplanationSection {
                heading: "Model narrative".into(),
                body: text,
            }],
            caveats: vec![
                "Optional cloud path. Telemetry facts stayed local; only the fact bundle was sent."
                    .into(),
                "Disable cloud with VERITAS_AI_MODE=deterministic for air gap.".into(),
            ],
            facts_id: facts.id.clone(),
            model: std::env::var("VERITAS_CLOUD_AI_MODEL").ok(),
        })
    }
}

fn build_prompt(facts: &FactBundle) -> String {
    format!(
        "Explain these VERITAS engineering facts for an SRE. Be precise. Do not invent numbers.\n\
         Kind: {}\n\
         Facts JSON:\n{}",
        facts.kind,
        serde_json::to_string_pretty(&facts.facts).unwrap_or_default()
    )
}

fn first_paragraph(s: &str) -> String {
    s.lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or(s)
        .trim()
        .chars()
        .take(280)
        .collect()
}

/// Always available. Templates over structured facts. No network.
pub fn deterministic_explain(facts: &FactBundle) -> Explanation {
    let f = &facts.facts;
    let (title, summary, mut sections) = match facts.kind.as_str() {
        "why" => {
            let what = f.get("what").and_then(|v| v.as_str()).unwrap_or("Incident");
            let conf = f.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let action = f
                .get("root_action")
                .and_then(|v| v.as_str())
                .unwrap_or("investigate");
            let chain = f
                .get("causal_chain")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|x| x.as_str())
                        .collect::<Vec<_>>()
                        .join(" → ")
                })
                .unwrap_or_default();
            (
                "Why this is happening".into(),
                format!(
                    "{what} · confidence {:.0}% · recommended action: {action}",
                    conf * 100.0
                ),
                vec![
                    ExplanationSection {
                        heading: "Causal chain".into(),
                        body: if chain.is_empty() {
                            "No chain in facts.".into()
                        } else {
                            chain
                        },
                    },
                    ExplanationSection {
                        heading: "Decision".into(),
                        body: format!(
                            "Act on the top hypothesis. Recommended: {action}. Expected recovery follows rollback or fix of the regressed path."
                        ),
                    },
                ],
            )
        }
        "changed" => {
            let primary = f
                .pointer("/primary/summary")
                .and_then(|v| v.as_str())
                .unwrap_or("Primary change unknown");
            let meaningful = f.get("meaningful").and_then(|v| v.as_u64()).unwrap_or(0);
            (
                "What changed".into(),
                format!("{meaningful} meaningful changes. Primary: {primary}"),
                vec![ExplanationSection {
                    heading: "Focus".into(),
                    body: format!(
                        "Start investigation at: {primary}. Correlate with latency and pool signals in the same window."
                    ),
                }],
            )
        }
        "next" => {
            let items = f
                .get("items")
                .and_then(|v| v.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            let summary = f
                .get("summary")
                .and_then(|v| v.as_str())
                .unwrap_or("Horizon computed.");
            (
                "What happens next".into(),
                summary.into(),
                vec![ExplanationSection {
                    heading: "Queue".into(),
                    body: format!("{items} forward looking items ranked by urgency."),
                }],
            )
        }
        "compress" => {
            let raw = f.get("raw").and_then(|v| v.as_u64()).unwrap_or(0);
            let actions = f.get("actions").and_then(|v| v.as_u64()).unwrap_or(0);
            (
                "Alert compression".into(),
                format!("{raw} raw alerts compressed into {actions} engineering actions."),
                vec![ExplanationSection {
                    heading: "Principle".into(),
                    body: "Noise becomes decisions. Work the action list top down.".into(),
                }],
            )
        }
        "worse" => {
            let worst = f.get("worst").and_then(|v| v.as_str()).unwrap_or("none");
            (
                "What is getting worse".into(),
                format!("Highest degradation score: {worst}"),
                vec![ExplanationSection {
                    heading: "Archaeology".into(),
                    body: "Slow trends matter more than single spikes. Fix systemic regression first."
                        .into(),
                }],
            )
        }
        "optimize" => {
            let save = f
                .get("total_monthly_save_usd")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            (
                "Optimization".into(),
                format!("About ${save:.0}/mo efficiency opportunity without high reliability risk."),
                vec![ExplanationSection {
                    heading: "Order".into(),
                    body: "Stabilize reliability before right sizing. Never cut during active fire."
                        .into(),
                }],
            )
        }
        "affected" => {
            let origin = f.get("origin").and_then(|v| v.as_str()).unwrap_or("entity");
            let impact = f
                .get("customer_impact")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            (
                "Blast and impact".into(),
                format!("Origin {origin}. {impact}"),
                vec![ExplanationSection {
                    heading: "Scope".into(),
                    body: "Limit blast by rolling back or isolating the origin service first.".into(),
                }],
            )
        }
        _ => (
            "System explanation".into(),
            "Structured facts available for explanation.".into(),
            vec![ExplanationSection {
                heading: "Facts".into(),
                body: serde_json::to_string_pretty(f).unwrap_or_default(),
            }],
        ),
    };

    sections.push(ExplanationSection {
        heading: "Fact source".into(),
        body: format!(
            "Bundle {} · kind {} · generated by VERITAS analytical engine",
            facts.id, facts.kind
        ),
    });

    Explanation {
        mode: "deterministic".into(),
        title,
        summary,
        sections,
        caveats: vec![
            "Deterministic template over facts. No model hallucination of metrics.".into(),
        ],
        facts_id: facts.id.clone(),
        model: Some("veritas-deterministic".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn deterministic_why() {
        let facts = FactBundle {
            id: "facts:why:svc:checkout".into(),
            kind: "why".into(),
            facts: serde_json::json!({
                "what": "API latency increased 42%",
                "confidence": 0.91,
                "root_action": "rollback v4.82.1",
                "causal_chain": ["deployment", "new query", "database latency"]
            }),
            generated_at: Utc::now(),
        };
        let e = deterministic_explain(&facts);
        assert!(e.summary.contains("91") || e.summary.contains("rollback"));
        assert_eq!(e.mode, "deterministic");
    }
}
