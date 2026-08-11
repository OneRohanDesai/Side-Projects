//! Phase 5 intelligence products · driven by live store only.

use chrono::Utc;
use veritas_core::*;

use crate::IntelligenceEngine;

impl IntelligenceEngine {
    pub fn affected(&self, entity_id: Option<&str>) -> AffectedReport {
        let snap = self.store.snapshot();
        let origin = entity_id
            .map(|s| s.to_string())
            .or_else(|| snap.entities.first().map(|e| e.id.clone()))
            .unwrap_or_else(|| "system".into());
        let incident = snap
            .incidents
            .iter()
            .find(|i| i.timeline.iter().any(|t| t.entity_id == origin))
            .or_else(|| snap.incidents.first());

        let mut services = Vec::new();
        let mut databases = Vec::new();
        let mut pods = Vec::new();
        let mut hosts = Vec::new();

        if snap.entities.iter().any(|e| e.id == origin) {
            if origin.starts_with("svc:") {
                services.push(origin.clone());
            }
        }

        for e in &snap.edges {
            if e.from == origin || e.to == origin {
                let other = if e.from == origin { &e.to } else { &e.from };
                if other.starts_with("svc:") && !services.contains(other) {
                    services.push(other.clone());
                }
                if (other.starts_with("db:") || other.starts_with("cache:"))
                    && !databases.contains(other)
                {
                    databases.push(other.clone());
                }
                if other.starts_with("pod:") && !pods.contains(other) {
                    pods.push(other.clone());
                }
                if (other.starts_with("host:") || other.starts_with("node:"))
                    && !hosts.contains(other)
                {
                    hosts.push(other.clone());
                }
            }
        }
        for e in &snap.edges {
            if e.to == origin && e.from.starts_with("svc:") && !services.contains(&e.from) {
                services.push(e.from.clone());
            }
        }

        let blast = incident
            .map(|i| i.blast_radius.clone())
            .unwrap_or(BlastRadius {
                services: services.len() as u32,
                pods: pods.len() as u32,
                request_pct: if services.is_empty() { 0.0 } else { 0.05 },
            });

        AffectedReport {
            origin,
            incident_id: incident.map(|i| i.id.clone()),
            services,
            databases,
            pods,
            hosts,
            blast,
            customer_impact: if incident.is_some() {
                "Active incident may impact user traffic on related services".into()
            } else if snap.entities.is_empty() {
                "No systems connected".into()
            } else {
                "No active customer impact detected".into()
            },
            slo_risk: if incident.is_some() {
                "ELEVATED".into()
            } else {
                "LOW".into()
            },
        }
    }

    pub fn next(&self) -> NextReport {
        let snap = self.store.snapshot();
        let mut items = Vec::new();

        if let Some(inc) = snap.incidents.iter().find(|i| i.status == "active") {
            items.push(NextItem {
                entity_id: inc
                    .timeline
                    .first()
                    .map(|t| t.entity_id.clone())
                    .unwrap_or_else(|| "system".into()),
                kind: "incident".into(),
                title: inc.title.clone(),
                urgency: "now".into(),
                eta: "immediate".into(),
                evidence: format!(
                    "confidence {:.0}% · {}",
                    inc.confidence * 100.0,
                    inc.root_cause
                ),
            });
        }

        for f in &snap.forecasts {
            if f.risk == "high" || f.risk == "critical" {
                let eta = f
                    .days_to_saturation
                    .map(|d| format!("~{d:.0} days"))
                    .unwrap_or_else(|| "unknown".into());
                items.push(NextItem {
                    entity_id: f.entity_id.clone(),
                    kind: "capacity".into(),
                    title: format!("{} approaching limit", f.resource.replace('_', " ")),
                    urgency: "soon".into(),
                    eta,
                    evidence: f.recommendation.clone(),
                });
            }
        }

        for s in snap.signals.iter().filter(|s| s.severity == "warn" || s.severity == "critical") {
            if s.name.contains("egress") || s.name.contains("security") {
                items.push(NextItem {
                    entity_id: s.entity_id.clone(),
                    kind: "security".into(),
                    title: format!("Security signal: {}", s.name),
                    urgency: "today".into(),
                    eta: "same day".into(),
                    evidence: format!("severity {}", s.severity),
                });
            }
        }

        let summary = if snap.entities.is_empty() {
            "No live systems. Connect a project to build the horizon.".into()
        } else if items.iter().any(|i| i.urgency == "now") {
            "Active incident dominates the horizon.".into()
        } else if items.is_empty() {
            "No urgent forward looking items.".into()
        } else {
            "Capacity and signals lead the queue.".into()
        };

        NextReport {
            generated_at: Utc::now(),
            items,
            summary,
        }
    }

    pub fn fix_plan(&self) -> Vec<Action> {
        let mut actions = self.actions();
        actions.sort_by_key(|a| a.priority);
        actions
    }

    pub fn getting_worse(&self) -> GettingWorseReport {
        let snap = self.store.snapshot();
        let mut entities = Vec::new();

        for e in &snap.entities {
            if e.kind != "service" && e.kind != "database" {
                continue;
            }
            let p99 = e
                .attributes
                .get("p99_change_30d")
                .and_then(|v| v.as_f64())
                .or_else(|| {
                    e.attributes
                        .get("query_latency_delta")
                        .and_then(|v| v.as_f64())
                })
                .unwrap_or(0.0);
            let err = e
                .attributes
                .get("error_change_30d")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let score = p99 * 0.7 + err * 0.3 + (1.0 - e.health) * 0.2;
            if score < 0.05 && e.health > 0.9 {
                continue;
            }
            let level = if score > 0.25 {
                "HIGH"
            } else if score > 0.1 {
                "MED"
            } else {
                "LOW"
            };
            entities.push(DegradationEntity {
                entity_id: e.id.clone(),
                name: e.name.clone(),
                score,
                p99_delta: p99,
                error_delta: err,
                level: level.into(),
            });
        }

        entities.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let worst = entities.first().map(|e| e.entity_id.clone());

        GettingWorseReport {
            window: "Live observation".into(),
            entities,
            worst,
        }
    }

    pub fn optimize(&self) -> OptimizeReport {
        let snap = self.store.snapshot();
        let mut opportunities = Vec::new();
        let mut total = 0.0;

        for c in &snap.cost_insights {
            if c.saving_usd > 0.0 && c.reliability_risk != "HIGH" {
                total += c.saving_usd;
                opportunities.push(OptimizeItem {
                    entity_id: c.entity_id.clone(),
                    category: "cost".into(),
                    title: format!("Right size {}", c.entity_id),
                    save_usd: c.saving_usd,
                    reliability_risk: c.reliability_risk.clone(),
                    rationale: c.recommendation.clone(),
                });
            }
        }

        for e in snap.entities.iter().filter(|e| e.health < 0.8) {
            opportunities.push(OptimizeItem {
                entity_id: e.id.clone(),
                category: "reliability".into(),
                title: format!("Stabilize {}", e.name),
                save_usd: 0.0,
                reliability_risk: "HIGH until healthy".into(),
                rationale: "Restore health before efficiency cuts".into(),
            });
        }

        OptimizeReport {
            opportunities,
            total_monthly_save_usd: total,
        }
    }

    pub fn alert_compression(&self) -> AlertCompressionReport {
        let snap = self.store.snapshot();
        let raw_alerts = snap.signals.len() as u32
            + snap.changes.len() as u32
            + snap
                .incidents
                .iter()
                .map(|i| i.timeline.len() as u32)
                .sum::<u32>();

        // Cluster by entity
        let mut by_entity: std::collections::HashMap<String, u32> =
            std::collections::HashMap::new();
        for s in &snap.signals {
            *by_entity.entry(s.entity_id.clone()).or_insert(0) += 1;
        }
        for c in &snap.changes {
            *by_entity.entry(c.entity_id.clone()).or_insert(0) += 1;
        }

        let mut clusters_detail: Vec<AlertCluster> = by_entity
            .into_iter()
            .map(|(entity_id, count)| {
                let severity = snap
                    .signals
                    .iter()
                    .filter(|s| s.entity_id == entity_id)
                    .map(|s| s.severity.as_str())
                    .max_by_key(|s| match *s {
                        "critical" => 3,
                        "high" => 2,
                        "warn" => 1,
                        _ => 0,
                    })
                    .unwrap_or("info");
                let linked = snap
                    .incidents
                    .iter()
                    .find(|i| i.timeline.iter().any(|t| t.entity_id == entity_id))
                    .map(|i| i.id.clone());
                AlertCluster {
                    id: format!("cl:{entity_id}"),
                    title: format!("Signals on {entity_id}"),
                    alert_count: count,
                    entity_ids: vec![entity_id],
                    severity: severity.into(),
                    linked_incident: linked,
                }
            })
            .collect();
        clusters_detail.sort_by(|a, b| b.alert_count.cmp(&a.alert_count));

        let clusters = clusters_detail.len() as u32;
        let incidents = snap.incidents.len() as u32;
        let root_causes = snap
            .incidents
            .iter()
            .filter(|i| !i.root_cause.is_empty())
            .count() as u32;
        let actions = snap.actions.len() as u32;

        let pipeline = vec![
            CompressionStage {
                name: "raw signals".into(),
                count: raw_alerts,
                note: "metrics deltas · changes · timeline events".into(),
            },
            CompressionStage {
                name: "entity clusters".into(),
                count: clusters,
                note: "grouped by entity".into(),
            },
            CompressionStage {
                name: "incidents".into(),
                count: incidents,
                note: "customer impacting".into(),
            },
            CompressionStage {
                name: "root causes".into(),
                count: root_causes,
                note: "ranked hypotheses".into(),
            },
            CompressionStage {
                name: "actions".into(),
                count: actions,
                note: "engineering decisions".into(),
            },
        ];

        AlertCompressionReport {
            raw_alerts,
            clusters,
            incidents,
            root_causes,
            actions,
            pipeline,
            clusters_detail,
            recommended_actions: self.fix_plan(),
        }
    }

    pub fn report_suite(&self) -> ReportSuite {
        let snap = self.store.snapshot();
        let daily = snap.daily_report.clone();

        let weekly = WeeklyReport {
            window: "Last 7 days".into(),
            deployments: snap
                .changes
                .iter()
                .filter(|c| c.kind == "deployment")
                .count() as u32,
            incidents: snap.incidents.len() as u32,
            mttr_minutes: 0.0,
            error_budget_burn: 0.0,
            top_regressed: snap
                .entities
                .iter()
                .filter(|e| e.health < 0.9)
                .map(|e| e.name.clone())
                .take(5)
                .collect(),
            narrative: if snap.entities.is_empty() {
                "No live systems connected this week.".into()
            } else {
                format!(
                    "{} entities modeled · {} incidents · {} changes observed.",
                    snap.entities.len(),
                    snap.incidents.len(),
                    snap.changes.len()
                )
            },
        };

        let capacity = if snap.forecasts.is_empty() {
            "CAPACITY REPORT\nNo capacity forecasts yet. Ingest metrics to enable projections."
                .into()
        } else {
            let mut lines = vec!["CAPACITY REPORT".into()];
            for f in &snap.forecasts {
                lines.push(format!(
                    "{} {} util {:.0}% · risk {} · {}",
                    f.entity_id,
                    f.resource,
                    f.utilization * 100.0,
                    f.risk,
                    f.recommendation
                ));
            }
            lines.join("\n")
        };

        let cost = if snap.cost_insights.is_empty() {
            "COST REPORT\nNo cost insights yet.".into()
        } else {
            let save: f64 = snap.cost_insights.iter().map(|c| c.saving_usd).sum();
            format!(
                "COST REPORT\nEfficiency opportunities ${save:.0}/mo\n{} entities with cost models",
                snap.cost_insights.len()
            )
        };

        let security = {
            let sec_signals: Vec<_> = snap
                .signals
                .iter()
                .filter(|s| {
                    s.name.contains("egress")
                        || s.name.contains("security")
                        || s.severity == "warn" && s.name.contains("unexpected")
                })
                .collect();
            if sec_signals.is_empty() {
                "SECURITY CONTEXT\nNo security signals in fabric.".into()
            } else {
                let mut lines = vec!["SECURITY CONTEXT".into()];
                for s in sec_signals {
                    lines.push(format!("{} · {} · {}", s.entity_id, s.name, s.severity));
                }
                lines.join("\n")
            }
        };

        let postmortem = if let Some(inc) = snap.incidents.first() {
            format!(
                "POSTMORTEM DRAFT\n\
                 Title: {}\n\
                 Status: {}\n\
                 Detected: {}\n\
                 Root cause (working): {}\n\
                 Confidence: {:.0}%\n\
                 Action: {}\n\
                 Source: analytical engine facts. Draft only.",
                inc.title,
                inc.status,
                inc.started_at,
                inc.root_cause,
                inc.confidence * 100.0,
                inc.recommended_action,
            )
        } else {
            "POSTMORTEM DRAFT\nNo incidents recorded.".into()
        };

        let incident = if let Some(inc) = snap.incidents.first() {
            format!(
                "INCIDENT REPORT\n{}\nCause: {}\nAction: {}\nChain: {}",
                inc.title,
                inc.root_cause,
                inc.recommended_action,
                inc.causal_chain.join(" → ")
            )
        } else {
            "INCIDENT REPORT\nNone active.".into()
        };

        ReportSuite {
            daily,
            weekly,
            capacity,
            cost,
            security,
            postmortem_draft: postmortem,
            incident,
        }
    }

    pub fn fact_bundle_for(&self, kind: &str, entity: Option<&str>) -> FactBundle {
        let id = format!("facts:{}:{}", kind, entity.unwrap_or("system"));
        let facts = match kind {
            "why" => {
                let w = self.why(entity);
                serde_json::json!({
                    "what": w.what,
                    "confidence": w.confidence,
                    "root_action": w.recommended_action,
                    "causal_chain": w.causal_chain,
                    "causes": w.possible_causes,
                    "blast": w.affected,
                    "evidence_count": w.evidence.len(),
                })
            }
            "changed" => {
                let c = self.what_changed("1h");
                serde_json::json!({
                    "window": c.window,
                    "meaningful": c.meaningful_changes,
                    "primary": c.primary,
                    "chain": c.causal_chain,
                })
            }
            "next" => serde_json::to_value(self.next()).unwrap_or_default(),
            "compress" => {
                let a = self.alert_compression();
                serde_json::json!({
                    "raw": a.raw_alerts,
                    "clusters": a.clusters,
                    "incidents": a.incidents,
                    "actions": a.actions,
                    "pipeline": a.pipeline,
                })
            }
            "worse" => serde_json::to_value(self.getting_worse()).unwrap_or_default(),
            "optimize" => serde_json::to_value(self.optimize()).unwrap_or_default(),
            "affected" => serde_json::to_value(self.affected(entity)).unwrap_or_default(),
            _ => serde_json::json!({ "overview": self.overview() }),
        };

        FactBundle {
            id,
            kind: kind.into(),
            facts,
            generated_at: Utc::now(),
        }
    }
}
