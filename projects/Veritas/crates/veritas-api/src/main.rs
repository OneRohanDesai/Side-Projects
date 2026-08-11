//! VERITAS control plane · local first engineering intelligence API.
//!
//! Default bind: 127.0.0.1:7420
//! Phase 7 enterprise · SSO · RBAC · audit · fleet · HA · packs

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;
use veritas_ai::{AiEngine, ExplainRequest};
use veritas_analytics::AnalyticsEngine;
use veritas_core::{PRODUCT_LATIN, PRODUCT_NAME, PRODUCT_PITCH, PRODUCT_TAGLINE};
use veritas_enterprise::{
    AgentHeartbeat, EnterpriseState, SignedPack,
};
use veritas_graph::SystemGraph;
use veritas_ingest::TelemetryFabric;
use veritas_intelligence::IntelligenceEngine;
use veritas_license::LicenseService;
use veritas_core::{Change, Edge, Entity, Incident, Signal, TimelineEvent, BlastRadius, Action};
use veritas_storage::Store;
use chrono::Utc;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    store: Store,
    intel: Arc<IntelligenceEngine>,
    fabric: TelemetryFabric,
    analytics: Arc<AnalyticsEngine>,
    graph: Arc<Mutex<SystemGraph>>,
    ai: Arc<AiEngine>,
    enterprise: EnterpriseState,
    license: Arc<Mutex<LicenseService>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // Production: empty until projects / agents / collectors connect.
    let store = Store::load_production()?;
    let intel = Arc::new(IntelligenceEngine::new(store.clone()));
    let fabric = TelemetryFabric::new();

    let data_dir = std::env::var("VERITAS_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs_data().unwrap_or_else(|| PathBuf::from("./.veritas/data"))
        });

    let analytics = AnalyticsEngine::open(&data_dir)?;
    analytics.bootstrap_snapshot(&store.snapshot())?;
    tracing::info!("analytics ready (empty · waiting for live metrics)");

    let graph = SystemGraph::from_snapshot(&store.snapshot());
    tracing::info!(
        entities = graph.stats().entities,
        edges = graph.stats().edges,
        "system graph ready (empty until project registration)"
    );

    let ai = AiEngine::from_env();
    tracing::info!("AI mode from env (default deterministic)");

    let enterprise = EnterpriseState::bootstrap();
    let license = LicenseService::bootstrap();
    tracing::info!("Phase 7 enterprise plane ready");

    let state = AppState {
        store,
        intel,
        fabric,
        analytics: Arc::new(analytics),
        graph: Arc::new(Mutex::new(graph)),
        ai: Arc::new(ai),
        enterprise,
        license: Arc::new(Mutex::new(license)),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/meta", get(meta))
        .route("/v1/system/overview", get(overview))
        .route("/v1/entities", get(list_entities))
        .route("/v1/entities/{id}", get(get_entity))
        .route("/v1/graph", get(graph_full))
        .route("/v1/graph/stats", get(graph_stats))
        .route("/v1/graph/blast-radius", get(blast_radius))
        .route("/v1/graph/path", get(graph_path))
        .route("/v1/graph/neighborhood", get(neighborhood))
        .route("/v1/graph/infer", post(graph_infer))
        .route("/v1/intelligence/what-changed", get(what_changed))
        .route("/v1/intelligence/why", get(why))
        .route("/v1/intelligence/forecast", get(forecast))
        .route("/v1/intelligence/archaeology", get(archaeology))
        .route("/v1/intelligence/actions", get(actions))
        .route("/v1/intelligence/cost", get(cost))
        .route("/v1/intelligence/affected", get(affected))
        .route("/v1/intelligence/next", get(next_horizon))
        .route("/v1/intelligence/fix", get(fix_plan))
        .route("/v1/intelligence/getting-worse", get(getting_worse))
        .route("/v1/intelligence/optimize", get(optimize))
        .route("/v1/intelligence/compress", get(alert_compression))
        .route("/v1/intelligence/facts", get(facts))
        .route("/v1/reports/daily", get(daily_report))
        .route("/v1/reports/suite", get(report_suite))
        .route("/v1/incidents", get(incidents))
        // Phase 6 AI
        .route("/v1/ai/status", get(ai_status))
        .route("/v1/ai/explain", post(ai_explain))
        .route("/v1/ai/explain/{kind}", get(ai_explain_kind))
        .route("/v1/license", get(license_status))
        .route("/v1/license/install", post(license_install))
        .route("/v1/license/mint", post(license_mint))
        .route("/v1/plugins", get(plugins))
        // Phase 2 telemetry
        .route("/v1/telemetry/status", get(telemetry_status))
        .route("/v1/telemetry/metrics", get(telemetry_metrics))
        .route("/v1/telemetry/logs", get(telemetry_logs))
        .route("/v1/telemetry/traces", get(telemetry_traces))
        .route("/v1/otel/v1/metrics", post(otel_metrics))
        .route("/v1/otel/v1/logs", post(otel_logs))
        .route("/v1/otel/v1/traces", post(otel_traces))
        .route("/v1/ingest/prometheus", post(prom_ingest))
        .route("/v1/discovery", get(discovery_get))
        .route("/v1/discovery/scan", post(discovery_scan))
        // Phase 3 analytics
        .route("/v1/analytics/status", get(analytics_status))
        .route("/v1/analytics/sql", post(analytics_sql))
        .route("/v1/analytics/aggregate", get(analytics_aggregate))
        .route("/v1/analytics/anomalies", get(analytics_anomalies))
        .route("/v1/analytics/forecast", get(analytics_forecast))
        .route("/v1/analytics/export/parquet", post(analytics_export))
        // Phase 7 enterprise
        .route("/v1/enterprise/overview", get(enterprise_overview))
        .route("/v1/auth/login", post(auth_login))
        .route("/v1/auth/logout", post(auth_logout))
        .route("/v1/auth/me", get(auth_me))
        .route("/v1/auth/sso", get(auth_sso_list))
        .route("/v1/auth/sso/toggle", post(auth_sso_toggle))
        .route("/v1/auth/oidc/map", post(auth_oidc_map))
        .route("/v1/rbac/roles", get(rbac_roles))
        .route("/v1/rbac/assignments", get(rbac_assignments))
        .route("/v1/rbac/check", get(rbac_check))
        .route("/v1/users", get(list_users))
        .route("/v1/audit", get(audit_list))
        .route("/v1/audit/verify", get(audit_verify))
        .route("/v1/fleet/agents", get(fleet_list))
        .route("/v1/fleet/heartbeat", post(fleet_heartbeat))
        .route("/v1/fleet/agents/{id}", post(fleet_remove))
        .route("/v1/ha", get(ha_status))
        .route("/v1/ha/enable", post(ha_enable))
        .route("/v1/packs", get(packs_list))
        .route("/v1/packs/install", post(packs_install))
        .route("/v1/packs/mint", post(packs_mint))
        // Live project registration (production path)
        .route("/v1/projects/register", post(project_register))
        .route("/v1/projects/event", post(project_event))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = "127.0.0.1:7420".parse()?;
    tracing::info!(
        "{name} control plane listening on http://{addr}",
        name = PRODUCT_NAME
    );
    tracing::info!("{PRODUCT_PITCH}");
    tracing::info!("Phase 7 enterprise · Rose Petal frozen");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn dirs_data() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".veritas/data"))
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "product": PRODUCT_NAME,
        "latin": PRODUCT_LATIN,
        "phase": "7-enterprise",
    }))
}

async fn meta() -> impl IntoResponse {
    Json(serde_json::json!({
        "name": PRODUCT_NAME,
        "latin": PRODUCT_LATIN,
        "tagline": PRODUCT_TAGLINE,
        "pitch": PRODUCT_PITCH,
        "philosophy": "Do not show engineers more telemetry. Turn telemetry into decisions.",
        "version": env!("CARGO_PKG_VERSION"),
        "phase": "7-enterprise",
        "palette": "rose-petal",
        "design": "frozen",
        "capabilities": [
            "telemetry", "analytics", "graph", "intelligence", "ai",
            "sso", "rbac", "audit", "fleet", "ha", "packs", "offline_license"
        ],
    }))
}

async fn overview(State(state): State<AppState>) -> impl IntoResponse {
    let mut ov = state.intel.overview();
    if let Ok(g) = state.graph.lock() {
        // Prefer richer graph entity count when topology is live
        let n = g.stats().entities as u32;
        if n > ov.entities {
            ov.entities = n;
        }
    }
    Json(ov)
}

async fn list_entities(State(state): State<AppState>) -> impl IntoResponse {
    let g = state.graph.lock().unwrap();
    let mut entities = g.entities();
    if entities.is_empty() {
        entities = state.store.entities();
    }
    Json(entities)
}

async fn get_entity(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let g = state.graph.lock().unwrap();
    let entity = g.entity(&id).cloned().ok_or(StatusCode::NOT_FOUND)?;
    let deps: Vec<String> = g
        .neighbors(&id, true, false)
        .into_iter()
        .map(|(_, n)| n.clone())
        .collect();
    let why_available = state
        .store
        .snapshot()
        .incidents
        .iter()
        .any(|i| i.timeline.iter().any(|t| t.entity_id == id));
    Ok(Json(serde_json::json!({
        "entity": entity,
        "dependencies": deps,
        "why_available": why_available,
    })))
}

async fn graph_full(State(state): State<AppState>) -> impl IntoResponse {
    let g = state.graph.lock().unwrap();
    if g.stats().entities == 0 {
        // Fall back to store topology
        let snap = state.store.snapshot();
        return Json(serde_json::json!({
            "nodes": snap.entities,
            "edges": snap.edges,
            "stats": {
                "entities": snap.entities.len(),
                "edges": snap.edges.len(),
            }
        }));
    }
    Json(g.to_graph_json())
}

async fn graph_stats(State(state): State<AppState>) -> impl IntoResponse {
    let g = state.graph.lock().unwrap();
    Json(g.stats())
}

#[derive(Deserialize)]
struct BlastQuery {
    entity: Option<String>,
    depth: Option<u32>,
}

async fn blast_radius(
    State(state): State<AppState>,
    Query(q): Query<BlastQuery>,
) -> impl IntoResponse {
    let entity = q.entity.as_deref().unwrap_or("svc:checkout");
    let depth = q.depth.unwrap_or(3);
    let g = state.graph.lock().unwrap();
    Json(g.blast_radius(entity, depth))
}

#[derive(Deserialize)]
struct PathQuery {
    from: Option<String>,
    to: Option<String>,
}

async fn graph_path(State(state): State<AppState>, Query(q): Query<PathQuery>) -> impl IntoResponse {
    let from = q.from.as_deref().unwrap_or("svc:checkout");
    let to = q.to.as_deref().unwrap_or("db:postgres-main");
    let g = state.graph.lock().unwrap();
    Json(g.path(from, to))
}

async fn neighborhood(
    State(state): State<AppState>,
    Query(q): Query<BlastQuery>,
) -> impl IntoResponse {
    let entity = q.entity.as_deref().unwrap_or("svc:checkout");
    let depth = q.depth.unwrap_or(2);
    let g = state.graph.lock().unwrap();
    Json(g.neighborhood(entity, depth))
}

async fn graph_infer(State(state): State<AppState>) -> impl IntoResponse {
    let mut g = state.graph.lock().unwrap();
    Json(g.infer_relationships())
}

#[derive(Deserialize)]
struct WindowQuery {
    window: Option<String>,
}

async fn what_changed(
    State(state): State<AppState>,
    Query(q): Query<WindowQuery>,
) -> impl IntoResponse {
    let window = q.window.as_deref().unwrap_or("1h");
    Json(state.intel.what_changed(window))
}

#[derive(Deserialize)]
struct EntityQuery {
    entity: Option<String>,
}

async fn why(State(state): State<AppState>, Query(q): Query<EntityQuery>) -> impl IntoResponse {
    Json(state.intel.why(q.entity.as_deref()))
}

async fn forecast(State(state): State<AppState>) -> impl IntoResponse {
    let mut list = state.intel.forecast();
    // If store has no capacity forecasts, synthesize light ones from analytics metrics
    if list.is_empty() {
        if let Ok(aggs) = state.analytics.aggregate(None) {
            for (i, a) in aggs.iter().take(8).enumerate() {
                let util = if a.p99 > 0.0 && a.avg > 0.0 {
                    (a.avg / (a.p99 * 1.5)).clamp(0.05, 0.95)
                } else {
                    0.2
                };
                list.push(veritas_core::Forecast {
                    id: format!("fc:live-{i}"),
                    entity_id: a.entity_id.clone().unwrap_or_else(|| "system".into()),
                    resource: a.metric.clone(),
                    utilization: util,
                    days_to_saturation: if util > 0.7 {
                        Some(((0.95 - util) / 0.01).max(1.0))
                    } else {
                        None
                    },
                    risk: if util > 0.8 {
                        "high".into()
                    } else if util > 0.5 {
                        "medium".into()
                    } else {
                        "low".into()
                    },
                    recommendation: format!(
                        "Live metric {} · avg {:.2} · p99 {:.2}",
                        a.metric, a.avg, a.p99
                    ),
                });
            }
        }
    }
    Json(list)
}

async fn archaeology(
    State(state): State<AppState>,
    Query(q): Query<EntityQuery>,
) -> impl IntoResponse {
    let snap = state.store.snapshot();
    let entity = q
        .entity
        .as_deref()
        .or_else(|| snap.entities.first().map(|e| e.id.as_str()))
        .unwrap_or("system");
    if let Some(report) = state.intel.archaeology(entity) {
        return Json(report);
    }
    // Soft empty report when entity not in store yet
    Json(veritas_core::ArchaeologyReport {
        entity_id: entity.into(),
        entity_name: entity.into(),
        window: "Live window".into(),
        performance: std::collections::HashMap::new(),
        errors_delta: 0.0,
        cpu_delta: 0.0,
        memory_delta: 0.0,
        database_query_latency_delta: 0.0,
        deployments: 0,
        incidents: 0,
        likely_degradation: "NONE".into(),
        narrative: if snap.entities.is_empty() {
            "No entities connected. Register a project to begin archaeology.".into()
        } else {
            format!("Entity {entity} not found in the live model.")
        },
    })
}

async fn actions(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.actions())
}

async fn cost(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.cost_insights())
}

async fn daily_report(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.daily_report())
}

async fn incidents(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.incidents())
}

async fn license_status(State(state): State<AppState>) -> impl IntoResponse {
    let lic = state.license.lock().unwrap();
    Json(lic.status())
}

#[derive(Deserialize)]
struct LicenseInstallBody {
    /// Full license JSON document
    license_json: Option<String>,
    /// Or path on local disk
    path: Option<String>,
}

async fn license_install(
    State(state): State<AppState>,
    Json(body): Json<LicenseInstallBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut lic = state.license.lock().unwrap();
    let st = if let Some(path) = body.path {
        lic.install_offline_file(std::path::Path::new(&path))
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    } else if let Some(json) = body.license_json {
        lic.install_offline_json(&json)
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    } else {
        return Err((StatusCode::BAD_REQUEST, "license_json or path required".into()));
    };
    state.enterprise.audit.lock().unwrap().record(
        "admin",
        "license.install",
        "license",
        &format!("edition {:?}", st.entitlement.edition),
        st.valid,
    );
    Ok(Json(st))
}

#[derive(Deserialize)]
struct LicenseMintBody {
    customer_id: Option<String>,
    bind_machine: Option<bool>,
}

async fn license_mint(
    State(state): State<AppState>,
    Json(body): Json<LicenseMintBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let lic = state.license.lock().unwrap();
    let customer = body.customer_id.as_deref().unwrap_or("enterprise-customer");
    let bind = body.bind_machine.unwrap_or(true);
    let ent = lic
        .mint_enterprise_offline(customer, bind)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    state.enterprise.audit.lock().unwrap().record(
        "system",
        "license.mint",
        "license",
        customer,
        true,
    );
    Ok(Json(ent))
}

async fn plugins() -> impl IntoResponse {
    Json(serde_json::json!([
        {
            "id": "prometheus",
            "name": "Prometheus",
            "version": "0.2.0",
            "status": "ready",
            "capabilities": ["metrics", "entities", "remote_write"],
            "edition": "free"
        },
        {
            "id": "kubernetes",
            "name": "Kubernetes",
            "version": "0.2.0",
            "status": "ready",
            "capabilities": ["entities", "relationships", "events", "discovery"],
            "edition": "free"
        },
        {
            "id": "docker",
            "name": "Docker",
            "version": "0.2.0",
            "status": "ready",
            "capabilities": ["entities", "metrics", "discovery"],
            "edition": "free"
        },
        {
            "id": "linux",
            "name": "Linux eBPF",
            "version": "0.1.0",
            "status": "planned",
            "capabilities": ["processes", "network", "syscalls"],
            "edition": "pro"
        },
        {
            "id": "postgres",
            "name": "PostgreSQL",
            "version": "0.1.0",
            "status": "ready",
            "capabilities": ["entities", "metrics", "queries"],
            "edition": "free"
        },
        {
            "id": "otel",
            "name": "OpenTelemetry",
            "version": "0.2.0",
            "status": "ready",
            "capabilities": ["metrics", "logs", "traces", "otlp_http"],
            "edition": "free"
        },
        {
            "id": "duckdb",
            "name": "DuckDB Analytics",
            "version": "0.3.0",
            "status": "ready",
            "capabilities": ["sql", "aggregate", "anomaly", "forecast", "parquet"],
            "edition": "free"
        }
    ]))
}

async fn telemetry_status(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.fabric.status())
}

async fn telemetry_metrics(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.fabric.metrics())
}

async fn telemetry_logs(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.fabric.logs())
}

async fn telemetry_traces(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.fabric.spans())
}

async fn otel_metrics(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let n = state.fabric.ingest_otel_metrics_json(&body);
    // mirror into analytics when flat metrics present
    if let Some(arr) = body.get("metrics").and_then(|v| v.as_array()) {
        for item in arr {
            if let (Some(name), Some(val)) = (
                item.get("name").and_then(|v| v.as_str()),
                item.get("value").and_then(|v| v.as_f64()),
            ) {
                let entity = item.get("entity_id").and_then(|v| v.as_str());
                let _ = state.analytics.ingest_metric(name, val, entity, "otel");
            }
        }
    }
    Json(serde_json::json!({ "accepted": n }))
}

async fn otel_logs(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let n = state.fabric.ingest_otel_logs_json(&body);
    Json(serde_json::json!({ "accepted": n }))
}

async fn otel_traces(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let n = state.fabric.ingest_otel_traces_json(&body);
    Json(serde_json::json!({ "accepted": n }))
}

async fn prom_ingest(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let n = state.fabric.ingest_prometheus_json(&body);
    if let Some(arr) = body
        .get("timeseries")
        .or_else(|| body.get("metrics"))
        .and_then(|v| v.as_array())
    {
        for item in arr {
            if let (Some(name), Some(val)) = (
                item.get("name")
                    .or_else(|| item.get("__name__"))
                    .and_then(|v| v.as_str()),
                item.get("value").and_then(|v| v.as_f64()),
            ) {
                let entity = item
                    .pointer("/labels/service")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("svc:{s}"));
                let _ = state
                    .analytics
                    .ingest_metric(name, val, entity.as_deref(), "prometheus");
            }
        }
    }
    Json(serde_json::json!({ "accepted": n }))
}

async fn discovery_get(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.fabric.discovered())
}

async fn discovery_scan(State(state): State<AppState>) -> impl IntoResponse {
    let result = state.fabric.scan_discovery();
    {
        let mut g = state.graph.lock().unwrap();
        g.merge_entities(result.entities.clone());
    }
    Json(result)
}

// ── Phase 3 analytics handlers ──────────────────────────────────────

async fn analytics_status(State(state): State<AppState>) -> Result<impl IntoResponse, StatusCode> {
    state
        .analytics
        .status()
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct SqlBody {
    query: String,
}

async fn analytics_sql(
    State(state): State<AppState>,
    Json(body): Json<SqlBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .analytics
        .sql(&body.query)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

#[derive(Deserialize)]
struct MetricQuery {
    metric: Option<String>,
    z: Option<f64>,
}

async fn analytics_aggregate(
    State(state): State<AppState>,
    Query(q): Query<MetricQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    state
        .analytics
        .aggregate(q.metric.as_deref())
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn analytics_anomalies(
    State(state): State<AppState>,
    Query(q): Query<MetricQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let z = q.z.unwrap_or(2.0);
    state
        .analytics
        .anomalies(z)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct ForecastQuery {
    metric: Option<String>,
    entity: Option<String>,
    threshold: Option<f64>,
    horizon: Option<i64>,
}

async fn analytics_forecast(
    State(state): State<AppState>,
    Query(q): Query<ForecastQuery>,
) -> impl IntoResponse {
    // Prefer live metric names when caller omits them
    let metric = q.metric.as_deref().unwrap_or("http_request_duration_ms_p99");
    let threshold = q.threshold.unwrap_or(500.0);
    let horizon = q.horizon.unwrap_or(14);
    match state
        .analytics
        .forecast_series(metric, q.entity.as_deref(), threshold, horizon)
    {
        Ok(fc) => Json(fc),
        Err(e) => Json(veritas_analytics::SeriesForecast {
            metric: metric.into(),
            entity_id: q.entity,
            slope_per_day: 0.0,
            intercept: 0.0,
            r_squared: 0.0,
            days_to_threshold: None,
            threshold,
            points: vec![],
            recommendation: format!(
                "Not enough history yet ({e}). Keep shipping metrics from your project."
            ),
        }),
    }
}

#[derive(Deserialize)]
struct ExportBody {
    table: Option<String>,
}

async fn analytics_export(
    State(state): State<AppState>,
    Json(body): Json<ExportBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let table = body.table.as_deref().unwrap_or("metrics");
    state
        .analytics
        .export_parquet(table)
        .map(|p| {
            Json(serde_json::json!({
                "table": table,
                "path": p.display().to_string(),
            }))
        })
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

// ── Phase 5 intelligence products ───────────────────────────────────

async fn affected(State(state): State<AppState>, Query(q): Query<EntityQuery>) -> impl IntoResponse {
    Json(state.intel.affected(q.entity.as_deref()))
}

async fn next_horizon(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.next())
}

async fn fix_plan(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.fix_plan())
}

async fn getting_worse(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.getting_worse())
}

async fn optimize(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.optimize())
}

async fn alert_compression(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.alert_compression())
}

async fn report_suite(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.intel.report_suite())
}

#[derive(Deserialize)]
struct FactsQuery {
    kind: Option<String>,
    entity: Option<String>,
}

async fn facts(State(state): State<AppState>, Query(q): Query<FactsQuery>) -> impl IntoResponse {
    let kind = q.kind.as_deref().unwrap_or("why");
    Json(state.intel.fact_bundle_for(kind, q.entity.as_deref()))
}

// ── Phase 6 AI ──────────────────────────────────────────────────────

async fn ai_status(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.ai.status().await)
}

async fn ai_explain(
    State(state): State<AppState>,
    Json(body): Json<ExplainRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    state
        .ai
        .explain(body)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

#[derive(Deserialize)]
struct ExplainKindQuery {
    entity: Option<String>,
    mode: Option<String>,
}

async fn ai_explain_kind(
    State(state): State<AppState>,
    Path(kind): Path<String>,
    Query(q): Query<ExplainKindQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let facts = state.intel.fact_bundle_for(&kind, q.entity.as_deref());
    state
        .ai
        .explain(ExplainRequest {
            facts,
            mode: q.mode,
        })
        .await
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

// ── Phase 7 enterprise ──────────────────────────────────────────────

async fn enterprise_overview(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.overview())
}

#[derive(Deserialize)]
struct LoginBody {
    username: String,
    password: String,
}

async fn auth_login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut auth = state.enterprise.auth.lock().unwrap();
    let rbac = state.enterprise.rbac.lock().unwrap();
    match auth.login_local(&body.username, &body.password) {
        Ok(sess) => {
            let token = sess.token.clone();
            let full = auth
                .enrich_session(&token, &rbac)
                .unwrap_or(sess);
            drop(rbac);
            drop(auth);
            state.enterprise.audit.lock().unwrap().record(
                &body.username,
                "auth.login",
                "session",
                "local",
                true,
            );
            Ok(Json(full))
        }
        Err(e) => {
            drop(rbac);
            drop(auth);
            state.enterprise.audit.lock().unwrap().record(
                &body.username,
                "auth.login",
                "session",
                &e.to_string(),
                false,
            );
            Err((StatusCode::UNAUTHORIZED, e.to_string()))
        }
    }
}

#[derive(Deserialize)]
struct TokenBody {
    token: String,
}

async fn auth_logout(
    State(state): State<AppState>,
    Json(body): Json<TokenBody>,
) -> impl IntoResponse {
    let mut auth = state.enterprise.auth.lock().unwrap();
    let ok = auth.logout(&body.token);
    drop(auth);
    state.enterprise.audit.lock().unwrap().record(
        "session",
        "auth.logout",
        "session",
        if ok { "ok" } else { "missing" },
        ok,
    );
    Json(serde_json::json!({ "logged_out": ok }))
}

#[derive(Deserialize)]
struct TokenQuery {
    token: Option<String>,
}

async fn auth_me(
    State(state): State<AppState>,
    Query(q): Query<TokenQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let token = q.token.ok_or(StatusCode::UNAUTHORIZED)?;
    let mut auth = state.enterprise.auth.lock().unwrap();
    let rbac = state.enterprise.rbac.lock().unwrap();
    auth.validate(&token, &rbac)
        .map(Json)
        .ok_or(StatusCode::UNAUTHORIZED)
}

async fn auth_sso_list(State(state): State<AppState>) -> impl IntoResponse {
    let auth = state.enterprise.auth.lock().unwrap();
    Json(auth.sso_providers().to_vec())
}

#[derive(Deserialize)]
struct SsoToggleBody {
    id: String,
    enabled: bool,
}

async fn auth_sso_toggle(
    State(state): State<AppState>,
    Json(body): Json<SsoToggleBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut auth = state.enterprise.auth.lock().unwrap();
    auth.set_sso_enabled(&body.id, body.enabled)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    drop(auth);
    state.enterprise.audit.lock().unwrap().record(
        "admin",
        "sso.toggle",
        &body.id,
        &format!("enabled={}", body.enabled),
        true,
    );
    Ok(Json(serde_json::json!({ "id": body.id, "enabled": body.enabled })))
}

#[derive(Deserialize)]
struct OidcMapBody {
    provider_id: String,
    email: String,
}

async fn auth_oidc_map(
    State(state): State<AppState>,
    Json(body): Json<OidcMapBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut auth = state.enterprise.auth.lock().unwrap();
    let rbac = state.enterprise.rbac.lock().unwrap();
    let sess = auth
        .login_oidc_map(&body.provider_id, &body.email)
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))?;
    let token = sess.token.clone();
    let full = auth.enrich_session(&token, &rbac).unwrap_or(sess);
    drop(rbac);
    drop(auth);
    state.enterprise.audit.lock().unwrap().record(
        &body.email,
        "auth.oidc",
        &body.provider_id,
        "mapped",
        true,
    );
    Ok(Json(full))
}

async fn rbac_roles(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.rbac.lock().unwrap().roles())
}

async fn rbac_assignments(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.rbac.lock().unwrap().assignments())
}

#[derive(Deserialize)]
struct RbacCheckQuery {
    user_id: Option<String>,
    permission: Option<String>,
}

async fn rbac_check(
    State(state): State<AppState>,
    Query(q): Query<RbacCheckQuery>,
) -> impl IntoResponse {
    let user = q.user_id.as_deref().unwrap_or("user:admin");
    let perm = q.permission.as_deref().unwrap_or("admin_all");
    let allowed = state.enterprise.rbac.lock().unwrap().can(user, perm);
    Json(serde_json::json!({ "user_id": user, "permission": perm, "allowed": allowed }))
}

async fn list_users(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.auth.lock().unwrap().users_public())
}

#[derive(Deserialize)]
struct AuditQuery {
    limit: Option<usize>,
}

async fn audit_list(
    State(state): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(50).min(500);
    Json(state.enterprise.audit.lock().unwrap().list(limit))
}

async fn audit_verify(State(state): State<AppState>) -> impl IntoResponse {
    let ok = state.enterprise.audit.lock().unwrap().verify_chain();
    Json(serde_json::json!({ "chain_valid": ok }))
}

async fn fleet_list(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.fleet.lock().unwrap().list())
}

async fn fleet_heartbeat(
    State(state): State<AppState>,
    Json(body): Json<AgentHeartbeat>,
) -> impl IntoResponse {
    let agent = state.enterprise.fleet.lock().unwrap().heartbeat(body);
    state.enterprise.audit.lock().unwrap().record(
        &agent.agent_id,
        "fleet.heartbeat",
        "agent",
        &agent.host,
        true,
    );
    Json(agent)
}

async fn fleet_remove(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let ok = state.enterprise.fleet.lock().unwrap().remove(&id);
    Json(serde_json::json!({ "removed": ok, "id": id }))
}

async fn ha_status(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.ha.lock().unwrap().status())
}

#[derive(Deserialize)]
struct HaEnableBody {
    peer_address: Option<String>,
}

async fn ha_enable(
    State(state): State<AppState>,
    Json(body): Json<HaEnableBody>,
) -> impl IntoResponse {
    let peer = body
        .peer_address
        .unwrap_or_else(|| "127.0.0.1:7421".into());
    let mut ha = state.enterprise.ha.lock().unwrap();
    ha.enable_ha_pair(&peer);
    let st = ha.status();
    drop(ha);
    state.enterprise.audit.lock().unwrap().record(
        "admin",
        "ha.enable",
        "cluster",
        &peer,
        true,
    );
    Json(st)
}

async fn packs_list(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.enterprise.packs.lock().unwrap().list())
}

async fn packs_install(
    State(state): State<AppState>,
    Json(body): Json<SignedPack>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let pack = state
        .enterprise
        .packs
        .lock()
        .unwrap()
        .verify_and_install(body)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    state.enterprise.audit.lock().unwrap().record(
        "admin",
        "packs.install",
        &pack.manifest.id,
        &pack.manifest.version,
        true,
    );
    Ok(Json(pack))
}

#[derive(Deserialize)]
struct PackMintBody {
    name: Option<String>,
    kind: Option<String>,
    modules: Option<Vec<String>>,
}

async fn packs_mint(
    State(state): State<AppState>,
    Json(body): Json<PackMintBody>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let name = body.name.unwrap_or_else(|| "Custom Pack".into());
    let kind = body.kind.unwrap_or_else(|| "custom".into());
    let modules = body.modules.unwrap_or_else(|| vec!["custom".into()]);
    let pack = state
        .enterprise
        .packs
        .lock()
        .unwrap()
        .mint_custom(&name, &kind, modules)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(pack))
}

// ── Live project registration ───────────────────────────────────────

#[derive(Deserialize)]
struct ProjectRegister {
    project: String,
    #[serde(default)]
    entities: Vec<Entity>,
    #[serde(default)]
    edges: Vec<Edge>,
    #[serde(default)]
    narrative: Option<String>,
}

async fn project_register(
    State(state): State<AppState>,
    Json(body): Json<ProjectRegister>,
) -> impl IntoResponse {
    let n_ent = body.entities.len();
    let n_edge = body.edges.len();

    state
        .store
        .replace_topology(body.entities.clone(), body.edges.clone());
    if let Some(n) = body.narrative {
        state.store.set_narrative(n);
    } else {
        state
            .store
            .set_narrative(format!("Project {} connected", body.project));
    }

    {
        let mut g = state.graph.lock().unwrap();
        *g = SystemGraph::from_snapshot(&state.store.snapshot());
        let _ = g.infer_relationships();
    }

    // Refresh analytics entity tables from live topology
    let _ = state.analytics.bootstrap_snapshot(&state.store.snapshot());

    state.enterprise.audit.lock().unwrap().record(
        "project",
        "project.register",
        &body.project,
        &format!("{n_ent} entities · {n_edge} edges"),
        true,
    );

    Json(serde_json::json!({
        "project": body.project,
        "entities": n_ent,
        "edges": n_edge,
        "status": "registered"
    }))
}

#[derive(Deserialize)]
struct ProjectEvent {
    /// change | signal | incident | action
    kind: String,
    #[serde(default)]
    change: Option<Change>,
    #[serde(default)]
    signal: Option<Signal>,
    #[serde(default)]
    incident: Option<Incident>,
    #[serde(default)]
    action: Option<Action>,
    /// Convenience: raise incident from metric spike
    #[serde(default)]
    metric_alert: Option<MetricAlert>,
}

#[derive(Deserialize)]
struct MetricAlert {
    entity_id: String,
    title: String,
    metric: String,
    value: f64,
    delta: f64,
    root_cause: Option<String>,
    recommended_action: Option<String>,
}

async fn project_event(
    State(state): State<AppState>,
    Json(body): Json<ProjectEvent>,
) -> impl IntoResponse {
    match body.kind.as_str() {
        "change" => {
            if let Some(mut c) = body.change {
                if c.id.is_empty() {
                    c.id = format!("chg:{}", Uuid::new_v4());
                }
                state.store.push_change(c);
            }
        }
        "signal" => {
            if let Some(mut s) = body.signal {
                if s.id.is_empty() {
                    s.id = format!("sig:{}", Uuid::new_v4());
                }
                state.store.push_signal(s.clone());
                let _ = state.analytics.ingest_metric(
                    &s.name,
                    s.value,
                    Some(&s.entity_id),
                    "project",
                );
            }
        }
        "incident" => {
            if let Some(mut i) = body.incident {
                if i.id.is_empty() {
                    i.id = format!("inc:{}", Uuid::new_v4());
                }
                state.store.push_incident(i);
            }
        }
        "action" => {
            if let Some(a) = body.action {
                let mut actions = state.store.snapshot().actions;
                actions.push(a);
                state.store.set_actions(actions);
            }
        }
        "metric_alert" => {
            if let Some(m) = body.metric_alert {
                let now = Utc::now();
                state.store.push_signal(Signal {
                    id: format!("sig:{}", Uuid::new_v4()),
                    entity_id: m.entity_id.clone(),
                    name: m.metric.clone(),
                    value: m.value,
                    unit: "ms".into(),
                    delta: m.delta,
                    observed_at: now,
                    severity: if m.delta > 0.3 {
                        "critical".into()
                    } else {
                        "high".into()
                    },
                });
                let _ = state.analytics.ingest_metric(
                    &m.metric,
                    m.value,
                    Some(&m.entity_id),
                    "project",
                );
                state.store.push_incident(Incident {
                    id: format!("inc:{}", Uuid::new_v4()),
                    title: m.title.clone(),
                    status: "active".into(),
                    confidence: 0.75,
                    root_cause: m
                        .root_cause
                        .unwrap_or_else(|| format!("spike in {}", m.metric)),
                    blast_radius: BlastRadius {
                        services: 1,
                        pods: 0,
                        request_pct: 0.2,
                    },
                    recommended_action: m
                        .recommended_action
                        .unwrap_or_else(|| "Investigate recent deploys and dependencies".into()),
                    expected_impact: "Service degradation until mitigated".into(),
                    started_at: now,
                    timeline: vec![TimelineEvent {
                        at: now,
                        event: format!("{} = {} (Δ{:.0}%)", m.metric, m.value, m.delta * 100.0),
                        entity_id: m.entity_id.clone(),
                    }],
                    causal_chain: vec![
                        "metric spike".into(),
                        m.metric.clone(),
                        "service impact".into(),
                    ],
                });
                state.store.set_actions(vec![Action {
                    id: format!("act:{}", Uuid::new_v4()),
                    priority: 1,
                    title: format!("Investigate {}", m.entity_id),
                    rationale: m.title,
                    entity_id: m.entity_id,
                    impact: "Restore baseline latency".into(),
                }]);
            }
        }
        _ => {}
    }

    Json(serde_json::json!({ "status": "accepted", "kind": body.kind }))
}
