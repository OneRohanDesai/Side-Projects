import { useEffect, useState } from 'react';
import {
  api,
  type AggregateBucket,
  type AnomalyPoint,
  type SeriesForecast,
  type SqlResult,
} from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

const DEFAULT_SQL =
  'SELECT name, entity_id, COUNT(*) AS n, AVG(value) AS avg_v FROM metrics GROUP BY 1, 2 ORDER BY n DESC';

export function Analytics() {
  const status = useApi(() => api.analyticsStatus(), []);
  const aggregates = useApi(() => api.analyticsAggregate(), []);
  const anomalies = useApi(() => api.analyticsAnomalies(2), []);

  const [sql, setSql] = useState(DEFAULT_SQL);
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [fc, setFc] = useState<SeriesForecast | null>(null);

  const loading = status.loading || aggregates.loading || anomalies.loading;
  // Do not treat optional series forecast failures as plane offline
  const error = status.error || aggregates.error || anomalies.error;

  useEffect(() => {
    const first = aggregates.data?.[0];
    if (!first) {
      setFc(null);
      return;
    }
    const metric = first.metric;
    const entity = first.entity_id ?? undefined;
    const threshold = metric.includes('error') || metric.includes('rate') ? 0.5 : 500;
    api
      .analyticsForecast(metric, entity, threshold, 14)
      .then(setFc)
      .catch(() => setFc(null));
  }, [aggregates.data]);

  async function runSql() {
    setRunning(true);
    setSqlError(null);
    try {
      const r = await api.analyticsSql(sql);
      setSqlResult(r);
    } catch (e) {
      setSqlResult(null);
      setSqlError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function exportParquet() {
    try {
      const r = await api.analyticsExport('metrics');
      setExportMsg(r.path);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const aggs: AggregateBucket[] = aggregates.data ?? [];
  const anoms: AnomalyPoint[] = anomalies.data ?? [];

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Analytics" topic="analytics">
        <button type="button" className="btn" onClick={exportParquet}>
          Parquet
        </button>
      </PageHead>

      <div className="grid grid-4">
        <div className="card">
          <h3>Backend</h3>
          <div className="stat accent mono">{status.data?.backend ?? '·'}</div>
        </div>
        <div className="card">
          <h3>Metric rows</h3>
          <div className="stat soft">{status.data?.metric_rows ?? 0}</div>
        </div>
        <div className="card">
          <h3>Entities</h3>
          <div className="stat sand">{status.data?.entity_rows ?? 0}</div>
        </div>
        <div className="card">
          <h3>Anomalies</h3>
          <div className="stat accent">{anoms.length}</div>
        </div>
      </div>

      {exportMsg && (
        <div className="card section-gap">
          <h3>Export</h3>
          <div className="mono">{exportMsg}</div>
        </div>
      )}

      <div className="card section-gap">
        <h3>SQL</h3>
        <textarea
          className="window-select"
          style={{ width: '100%', minHeight: 88, resize: 'vertical', fontFamily: 'var(--mono)' }}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
        />
        <div className="btn-row section-gap">
          <button type="button" className="btn btn-primary" onClick={runSql} disabled={running}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
        {sqlError && (
          <div className="error-box section-gap" style={{ padding: 12, textAlign: 'left' }}>
            {sqlError}
          </div>
        )}
        {sqlResult && (
          <div className="section-gap">
            <div className="stat-sub">
              {sqlResult.row_count} rows{sqlResult.truncated ? ' · truncated' : ''}
            </div>
            <table className="table">
              <thead>
                <tr>
                  {sqlResult.columns.map((c) => (
                    <th key={c.name}>{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sqlResult.rows.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="mono">
                        {cell === null ? 'null' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Aggregates</h3>
          {aggs.length === 0 ? (
            <p className="stat-sub">No metric rows yet. Ship telemetry from a project.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Entity</th>
                  <th>p95</th>
                  <th>p99</th>
                </tr>
              </thead>
              <tbody>
                {aggs.slice(0, 12).map((a) => (
                  <tr key={a.metric + (a.entity_id ?? '')}>
                    <td className="mono">{a.metric}</td>
                    <td className="mono" style={{ color: 'var(--text-mute)' }}>
                      {a.entity_id ?? '·'}
                    </td>
                    <td className="mono">{a.p95.toFixed(2)}</td>
                    <td className="mono" style={{ color: 'var(--color-1)' }}>
                      {a.p99.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Anomalies</h3>
          {anoms.length === 0 ? (
            <p className="stat-sub">No anomalies above threshold.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>z</th>
                  <th>Value</th>
                  <th>Sev</th>
                </tr>
              </thead>
              <tbody>
                {anoms.slice(0, 12).map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.metric}</td>
                    <td className="mono" style={{ color: 'var(--color-1)' }}>
                      {a.z_score.toFixed(2)}
                    </td>
                    <td className="mono">{a.value.toFixed(3)}</td>
                    <td>
                      <span
                        className={`badge ${a.severity === 'critical' || a.severity === 'high' ? 'high' : 'med'}`}
                      >
                        {a.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {fc && (
        <div className="card section-gap">
          <h3>Series forecast</h3>
          <div className="mono" style={{ color: 'var(--text-mute)' }}>
            {fc.metric} · {fc.entity_id ?? 'all'}
          </div>
          {fc.points.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>{fc.recommendation}</p>
          ) : (
            <>
              <div className="grid grid-3 section-gap">
                <div>
                  <div className="stat-sub">Slope / day</div>
                  <div className="stat soft">{fc.slope_per_day.toFixed(4)}</div>
                </div>
                <div>
                  <div className="stat-sub">R²</div>
                  <div className="stat sand">{fc.r_squared.toFixed(3)}</div>
                </div>
                <div>
                  <div className="stat-sub">Days to {fc.threshold}</div>
                  <div className="stat accent">
                    {fc.days_to_threshold != null ? fc.days_to_threshold.toFixed(0) : '·'}
                  </div>
                </div>
              </div>
              <p style={{ color: 'var(--text-dim)', margin: '12px 0 0' }}>{fc.recommendation}</p>
            </>
          )}
        </div>
      )}
    </LoadState>
  );
}
