//! Phase 3 analytics engine.
//!
//! DuckDB hot path · Parquet historical · aggregation · anomaly · forecast · SQL.
//! Deterministic first. No LLM required.

use anyhow::{bail, Context, Result};
use chrono::{Duration, Utc};
use duckdb::{params, types::ValueRef, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use uuid::Uuid;
use veritas_core::SystemSnapshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlColumn {
    pub name: String,
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlResult {
    pub columns: Vec<SqlColumn>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateBucket {
    pub bucket: String,
    pub metric: String,
    pub entity_id: Option<String>,
    pub count: u64,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyPoint {
    pub id: String,
    pub metric: String,
    pub entity_id: Option<String>,
    pub value: f64,
    pub mean: f64,
    pub stddev: f64,
    pub z_score: f64,
    pub severity: String,
    pub observed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastPoint {
    pub t: i64,
    pub value: f64,
    pub predicted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesForecast {
    pub metric: String,
    pub entity_id: Option<String>,
    pub slope_per_day: f64,
    pub intercept: f64,
    pub r_squared: f64,
    pub days_to_threshold: Option<f64>,
    pub threshold: f64,
    pub points: Vec<ForecastPoint>,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsStatus {
    pub backend: String,
    pub tables: Vec<String>,
    pub metric_rows: u64,
    pub signal_rows: u64,
    pub entity_rows: u64,
    pub parquet_exports: Vec<String>,
    pub data_dir: String,
}

pub struct AnalyticsEngine {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl AnalyticsEngine {
    pub fn open(data_dir: impl AsRef<Path>) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&data_dir)
            .with_context(|| format!("create analytics dir {}", data_dir.display()))?;
        std::fs::create_dir_all(data_dir.join("parquet"))?;

        let db_path = data_dir.join("veritas.duckdb");
        let conn = Connection::open(&db_path)
            .with_context(|| format!("open duckdb {}", db_path.display()))?;

        let engine = Self {
            conn: Mutex::new(conn),
            data_dir,
        };
        engine.init_schema()?;
        Ok(engine)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().context("open duckdb memory")?;
        let engine = Self {
            conn: Mutex::new(conn),
            data_dir: PathBuf::from("/tmp/veritas-analytics-mem"),
        };
        let _ = std::fs::create_dir_all(engine.data_dir.join("parquet"));
        engine.init_schema()?;
        Ok(engine)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS entities (
                id VARCHAR PRIMARY KEY,
                kind VARCHAR,
                name VARCHAR,
                health DOUBLE,
                labels_json VARCHAR,
                attributes_json VARCHAR
            );
            CREATE TABLE IF NOT EXISTS edges (
                id VARCHAR PRIMARY KEY,
                from_id VARCHAR,
                to_id VARCHAR,
                edge_type VARCHAR,
                weight DOUBLE,
                observed BOOLEAN
            );
            CREATE TABLE IF NOT EXISTS signals (
                id VARCHAR PRIMARY KEY,
                entity_id VARCHAR,
                name VARCHAR,
                value DOUBLE,
                unit VARCHAR,
                delta DOUBLE,
                observed_at VARCHAR,
                severity VARCHAR
            );
            CREATE TABLE IF NOT EXISTS metrics (
                id VARCHAR PRIMARY KEY,
                name VARCHAR,
                value DOUBLE,
                unit VARCHAR,
                entity_id VARCHAR,
                resource VARCHAR,
                source VARCHAR,
                observed_at VARCHAR
            );
            CREATE TABLE IF NOT EXISTS changes (
                id VARCHAR PRIMARY KEY,
                kind VARCHAR,
                entity_id VARCHAR,
                summary VARCHAR,
                correlation DOUBLE,
                occurred_at VARCHAR,
                source VARCHAR
            );
            "#,
        )?;
        Ok(())
    }

    pub fn bootstrap_snapshot(&self, snap: &SystemSnapshot) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM entities", [])?;
        conn.execute("DELETE FROM edges", [])?;
        conn.execute("DELETE FROM signals", [])?;
        conn.execute("DELETE FROM changes", [])?;

        for e in &snap.entities {
            conn.execute(
                "INSERT OR REPLACE INTO entities VALUES (?, ?, ?, ?, ?, ?)",
                params![
                    e.id,
                    e.kind,
                    e.name,
                    e.health,
                    serde_json::to_string(&e.labels)?,
                    serde_json::to_string(&e.attributes)?,
                ],
            )?;
        }
        for edge in &snap.edges {
            conn.execute(
                "INSERT OR REPLACE INTO edges VALUES (?, ?, ?, ?, ?, ?)",
                params![
                    edge.id,
                    edge.from,
                    edge.to,
                    edge.edge_type,
                    edge.weight,
                    edge.observed,
                ],
            )?;
        }
        for s in &snap.signals {
            conn.execute(
                "INSERT OR REPLACE INTO signals VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    s.id,
                    s.entity_id,
                    s.name,
                    s.value,
                    s.unit,
                    s.delta,
                    s.observed_at.to_rfc3339(),
                    s.severity,
                ],
            )?;
        }
        for c in &snap.changes {
            conn.execute(
                "INSERT OR REPLACE INTO changes VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    c.id,
                    c.kind,
                    c.entity_id,
                    c.summary,
                    c.correlation,
                    c.occurred_at.to_rfc3339(),
                    c.source,
                ],
            )?;
        }
        Ok(())
    }

    /// Seed synthetic metric history for analytics demos and tests.
    pub fn seed_metric_history(&self) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM metrics", [])?;
        let series = [
            ("http_server_duration_ms_p99", "svc:checkout", 280.0, 8.0),
            ("db_query_duration_ms", "db:postgres-main", 40.0, 5.5),
            ("process_cpu_usage", "host:node-17", 0.45, 0.008),
            ("pg_storage_util", "db:postgres-main", 0.55, 0.007),
            ("error_rate", "svc:checkout", 0.004, 0.0006),
        ];
        let mut n = 0u64;
        let now = Utc::now();
        for (name, entity, base, slope) in series {
            for day in 0..30 {
                let t = now - Duration::days(29 - day);
                // mild noise + trend; last 2 days spike for checkout latency
                let mut value = base + slope * day as f64;
                if name == "http_server_duration_ms_p99" && day >= 28 {
                    value *= 1.45;
                }
                if name == "db_query_duration_ms" && day >= 28 {
                    value *= 1.8;
                }
                let noise = ((day * 17) % 7) as f64 * 0.01 * base;
                value += noise;
                let id = format!("{}-{}-{}", name, entity, day);
                conn.execute(
                    "INSERT INTO metrics VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        id,
                        name,
                        value,
                        if name.contains("usage") || name.contains("util") || name.contains("rate") {
                            "ratio"
                        } else {
                            "ms"
                        },
                        entity,
                        entity,
                        "seed",
                        t.to_rfc3339(),
                    ],
                )?;
                n += 1;
            }
        }
        Ok(n)
    }

    pub fn ingest_metric(
        &self,
        name: &str,
        value: f64,
        entity_id: Option<&str>,
        source: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO metrics VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                Uuid::new_v4().to_string(),
                name,
                value,
                Option::<String>::None,
                entity_id,
                entity_id,
                source,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn status(&self) -> Result<AnalyticsStatus> {
        let conn = self.conn.lock().unwrap();
        let metric_rows: u64 = conn
            .query_row("SELECT COUNT(*) FROM metrics", [], |r| r.get(0))
            .unwrap_or(0);
        let signal_rows: u64 = conn
            .query_row("SELECT COUNT(*) FROM signals", [], |r| r.get(0))
            .unwrap_or(0);
        let entity_rows: u64 = conn
            .query_row("SELECT COUNT(*) FROM entities", [], |r| r.get(0))
            .unwrap_or(0);

        let parquet_dir = self.data_dir.join("parquet");
        let mut exports = Vec::new();
        if let Ok(rd) = std::fs::read_dir(&parquet_dir) {
            for e in rd.flatten() {
                if e.path().extension().and_then(|s| s.to_str()) == Some("parquet") {
                    exports.push(e.file_name().to_string_lossy().to_string());
                }
            }
        }
        exports.sort();

        Ok(AnalyticsStatus {
            backend: "duckdb".into(),
            tables: vec![
                "entities".into(),
                "edges".into(),
                "signals".into(),
                "metrics".into(),
                "changes".into(),
            ],
            metric_rows,
            signal_rows,
            entity_rows,
            parquet_exports: exports,
            data_dir: self.data_dir.display().to_string(),
        })
    }

    /// Read only SQL. Blocks writes and dangerous statements.
    pub fn sql(&self, query: &str) -> Result<SqlResult> {
        let q = query.trim();
        if q.is_empty() {
            bail!("empty query");
        }
        let upper = q.to_uppercase();
        let forbidden = [
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "ATTACH",
            "COPY", "EXPORT", "PRAGMA", "INSTALL", "LOAD", "CALL", "EXECUTE",
        ];
        for word in forbidden {
            // crude token guard
            if upper.split_whitespace().any(|t| t == word)
                || upper.contains(&format!("{word} "))
                || upper.starts_with(word)
            {
                // allow SELECT ... (no writes)
                if word != "SELECT" && upper.split(|c: char| !c.is_alphanumeric()).any(|t| t == word)
                {
                    // still allow words inside identifiers carefully — keep strict
                    if upper
                        .split(|c: char| !(c.is_alphanumeric() || c == '_'))
                        .any(|t| t == word)
                    {
                        bail!("query rejected: {word} is not allowed");
                    }
                }
            }
        }
        if !upper.starts_with("SELECT") && !upper.starts_with("WITH") && !upper.starts_with("DESCRIBE")
            && !upper.starts_with("SHOW")
        {
            bail!("only SELECT / WITH / DESCRIBE / SHOW queries are allowed");
        }

        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(q)?;
        let mut rows_iter = stmt.query([])?;

        let mut columns: Vec<SqlColumn> = Vec::new();
        let mut rows = Vec::new();
        let mut truncated = false;
        let mut row_count = 0usize;

        while let Some(row) = rows_iter.next()? {
            row_count += 1;
            if rows.len() >= 500 {
                truncated = true;
                continue;
            }
            // Discover width by probing indices on first row
            if columns.is_empty() {
                for i in 0..64 {
                    if row.get_ref(i).is_err() {
                        break;
                    }
                    columns.push(SqlColumn {
                        name: format!("c{i}"),
                        type_name: "ANY".into(),
                    });
                }
            }
            let mut vals = Vec::new();
            for i in 0..columns.len() {
                let v = match row.get_ref(i) {
                    Ok(ValueRef::Null) => serde_json::Value::Null,
                    Ok(ValueRef::Boolean(b)) => serde_json::Value::Bool(b),
                    Ok(ValueRef::TinyInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::SmallInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::Int(n)) => serde_json::json!(n),
                    Ok(ValueRef::BigInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::HugeInt(n)) => serde_json::json!(n.to_string()),
                    Ok(ValueRef::UTinyInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::USmallInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::UInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::UBigInt(n)) => serde_json::json!(n),
                    Ok(ValueRef::Float(n)) => serde_json::json!(n),
                    Ok(ValueRef::Double(n)) => serde_json::json!(n),
                    Ok(ValueRef::Decimal(d)) => serde_json::json!(d.to_string()),
                    Ok(ValueRef::Text(bytes)) => {
                        serde_json::Value::String(String::from_utf8_lossy(bytes).into_owned())
                    }
                    Ok(ValueRef::Blob(_)) => serde_json::Value::String("<blob>".into()),
                    Ok(ValueRef::Date32(n)) => serde_json::json!(n),
                    Ok(ValueRef::Time64(_, n)) => serde_json::json!(n),
                    Ok(ValueRef::Timestamp(_, n)) => serde_json::json!(n),
                    Ok(ValueRef::Interval { months, days, nanos }) => {
                        serde_json::json!({ "months": months, "days": days, "nanos": nanos })
                    }
                    Ok(_) => serde_json::Value::String("<value>".into()),
                    Err(_) => serde_json::Value::Null,
                };
                vals.push(v);
            }
            rows.push(vals);
        }

        Ok(SqlResult {
            columns,
            rows,
            row_count,
            truncated,
        })
    }

    pub fn aggregate(&self, metric: Option<&str>) -> Result<Vec<AggregateBucket>> {
        let conn = self.conn.lock().unwrap();
        let sql = if let Some(m) = metric {
            format!(
                r#"
                SELECT name, entity_id,
                       COUNT(*)::BIGINT,
                       AVG(value), MIN(value), MAX(value),
                       QUANTILE_CONT(value, 0.5),
                       QUANTILE_CONT(value, 0.95),
                       QUANTILE_CONT(value, 0.99)
                FROM metrics
                WHERE name = '{}'
                GROUP BY name, entity_id
                ORDER BY name, entity_id
                "#,
                m.replace('\'', "''")
            )
        } else {
            r#"
                SELECT name, entity_id,
                       COUNT(*)::BIGINT,
                       AVG(value), MIN(value), MAX(value),
                       QUANTILE_CONT(value, 0.5),
                       QUANTILE_CONT(value, 0.95),
                       QUANTILE_CONT(value, 0.99)
                FROM metrics
                GROUP BY name, entity_id
                ORDER BY name, entity_id
            "#
            .to_string()
        };

        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query([])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            let name: String = row.get(0)?;
            let entity: Option<String> = row.get(1)?;
            out.push(AggregateBucket {
                bucket: "all".into(),
                metric: name,
                entity_id: entity,
                count: row.get::<_, i64>(2)? as u64,
                avg: row.get(3)?,
                min: row.get(4)?,
                max: row.get(5)?,
                p50: row.get(6)?,
                p95: row.get(7)?,
                p99: row.get(8)?,
            });
        }
        Ok(out)
    }

    pub fn anomalies(&self, z_threshold: f64) -> Result<Vec<AnomalyPoint>> {
        let conn = self.conn.lock().unwrap();
        // Per metric+entity z score against history
        let sql = r#"
            WITH stats AS (
                SELECT name, entity_id,
                       AVG(value) AS mean,
                       STDDEV_SAMP(value) AS stddev
                FROM metrics
                GROUP BY name, entity_id
            )
            SELECT m.id, m.name, m.entity_id, m.value, s.mean, COALESCE(s.stddev, 0),
                   CASE WHEN COALESCE(s.stddev, 0) < 1e-9 THEN 0
                        ELSE (m.value - s.mean) / s.stddev END AS z,
                   CAST(m.observed_at AS VARCHAR)
            FROM metrics m
            JOIN stats s ON m.name = s.name AND (m.entity_id = s.entity_id OR (m.entity_id IS NULL AND s.entity_id IS NULL))
            ORDER BY ABS(z) DESC
        "#;
        let mut stmt = conn.prepare(sql)?;
        let mut rows = stmt.query([])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            let z: f64 = row.get(6)?;
            if z.abs() < z_threshold {
                continue;
            }
            let severity = if z.abs() >= 3.0 {
                "critical"
            } else if z.abs() >= 2.5 {
                "high"
            } else {
                "warn"
            };
            let observed: String = row.get::<_, String>(7).unwrap_or_default();
            out.push(AnomalyPoint {
                id: row.get(0)?,
                metric: row.get(1)?,
                entity_id: row.get(2)?,
                value: row.get(3)?,
                mean: row.get(4)?,
                stddev: row.get(5)?,
                z_score: z,
                severity: severity.into(),
                observed_at: observed,
            });
            if out.len() >= 50 {
                break;
            }
        }
        Ok(out)
    }

    pub fn forecast_series(
        &self,
        metric: &str,
        entity_id: Option<&str>,
        threshold: f64,
        horizon_days: i64,
    ) -> Result<SeriesForecast> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT CAST(observed_at AS VARCHAR), value FROM metrics WHERE name = ? ",
        );
        if entity_id.is_some() {
            sql.push_str("AND entity_id = ? ");
        }
        sql.push_str("ORDER BY observed_at");

        let mut stmt = conn.prepare(&sql)?;
        let mut rows = if let Some(e) = entity_id {
            stmt.query(params![metric, e])?
        } else {
            stmt.query(params![metric])?
        };

        let mut xs = Vec::new();
        let mut ys = Vec::new();
        let mut points = Vec::new();
        let mut i = 0.0;
        while let Some(row) = rows.next()? {
            let t_str: String = row.get(0)?;
            let y: f64 = row.get(1)?;
            let ts = chrono::DateTime::parse_from_rfc3339(&t_str)
                .map(|d| d.timestamp())
                .unwrap_or(i as i64);
            xs.push(i);
            ys.push(y);
            points.push(ForecastPoint {
                t: ts,
                value: y,
                predicted: false,
            });
            i += 1.0;
        }

        if xs.len() < 2 {
            bail!("need at least 2 points to forecast");
        }

        let (slope, intercept, r2) = linear_regression(&xs, &ys);
        let last_x = *xs.last().unwrap();
        let last_t = points.last().map(|p| p.t).unwrap_or(0);
        for d in 1..=horizon_days {
            let x = last_x + d as f64;
            let y = intercept + slope * x;
            points.push(ForecastPoint {
                t: last_t + d * 86400,
                value: y,
                predicted: true,
            });
        }

        let last_y = *ys.last().unwrap();
        let days_to_threshold = if slope.abs() < 1e-12 {
            None
        } else {
            let days = (threshold - last_y) / slope;
            if days.is_finite() && days > 0.0 {
                Some(days)
            } else {
                None
            }
        };

        let recommendation = match days_to_threshold {
            Some(d) if d < 14.0 => format!(
                "Threshold {threshold:.3} in ~{d:.0} days at current slope. Act soon."
            ),
            Some(d) if d < 45.0 => format!(
                "Threshold {threshold:.3} in ~{d:.0} days. Plan capacity."
            ),
            Some(_) | None => "No near term threshold breach at current slope.".into(),
        };

        Ok(SeriesForecast {
            metric: metric.into(),
            entity_id: entity_id.map(|s| s.into()),
            slope_per_day: slope,
            intercept,
            r_squared: r2,
            days_to_threshold,
            threshold,
            points,
            recommendation,
        })
    }

    pub fn export_parquet(&self, table: &str) -> Result<PathBuf> {
        let allowed = ["metrics", "signals", "entities", "edges", "changes"];
        if !allowed.contains(&table) {
            bail!("table not allowed for export: {table}");
        }
        let path = self
            .data_dir
            .join("parquet")
            .join(format!("{table}.parquet"));
        let path_str = path.to_string_lossy().replace('\'', "''");
        let conn = self.conn.lock().unwrap();
        conn.execute(
            &format!("COPY {table} TO '{path_str}' (FORMAT PARQUET)"),
            [],
        )
        .with_context(|| format!("export {table} to parquet"))?;
        Ok(path)
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }
}

fn linear_regression(xs: &[f64], ys: &[f64]) -> (f64, f64, f64) {
    let n = xs.len() as f64;
    let mean_x = xs.iter().sum::<f64>() / n;
    let mean_y = ys.iter().sum::<f64>() / n;
    let mut num = 0.0;
    let mut den = 0.0;
    let mut ss_tot = 0.0;
    for i in 0..xs.len() {
        num += (xs[i] - mean_x) * (ys[i] - mean_y);
        den += (xs[i] - mean_x).powi(2);
        ss_tot += (ys[i] - mean_y).powi(2);
    }
    let slope = if den.abs() < 1e-12 { 0.0 } else { num / den };
    let intercept = mean_y - slope * mean_x;
    let mut ss_res = 0.0;
    for i in 0..xs.len() {
        let pred = intercept + slope * xs[i];
        ss_res += (ys[i] - pred).powi(2);
    }
    let r2 = if ss_tot.abs() < 1e-12 {
        1.0
    } else {
        1.0 - ss_res / ss_tot
    };
    (slope, intercept, r2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use veritas_storage::Store;

    #[test]
    fn analytics_pipeline() {
        let eng = AnalyticsEngine::open_in_memory().expect("engine");
        eng.bootstrap_snapshot(&Store::empty().snapshot()).expect("boot");
        // Seed history only for unit tests of analytics math
        let n = eng.seed_metric_history().expect("seed");
        assert!(n >= 100);

        let aggs = eng.aggregate(None).expect("agg");
        assert!(!aggs.is_empty());

        let anomalies = eng.anomalies(1.5).expect("anom");
        assert!(!anomalies.is_empty());

        let fc = eng
            .forecast_series("pg_storage_util", Some("db:postgres-main"), 0.8, 14)
            .expect("fc");
        assert!(fc.points.iter().any(|p| p.predicted));

        let sql = eng
            .sql("SELECT name, COUNT(*) AS n FROM metrics GROUP BY name ORDER BY n DESC")
            .expect("sql");
        assert!(sql.row_count >= 1);

        let bad = eng.sql("DELETE FROM metrics");
        assert!(bad.is_err());
    }
}
