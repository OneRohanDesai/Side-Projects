import { Link } from 'react-router-dom';
import { api, pct, delta } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Intelligence() {
  const affected = useApi(() => api.affected(), []);
  const next = useApi(() => api.next(), []);
  const worse = useApi(() => api.gettingWorse(), []);
  const optimize = useApi(() => api.optimize(), []);
  const compress = useApi(() => api.compress(), []);
  const fix = useApi(() => api.fixPlan(), []);

  const loading =
    affected.loading ||
    next.loading ||
    worse.loading ||
    optimize.loading ||
    compress.loading ||
    fix.loading;
  const error =
    affected.error ||
    next.error ||
    worse.error ||
    optimize.error ||
    compress.error ||
    fix.error;

  const c = compress.data;

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Intelligence" topic="intelligence">
        <div className="btn-row">
          <Link className="btn btn-primary" to="/why">
            Why
          </Link>
          <Link className="btn" to="/ai">
            Explain
          </Link>
        </div>
      </PageHead>

      {c && (
        <div className="card incident-banner">
          <h3>Alert compression</h3>
          <div className="grid grid-4 section-gap">
            <div>
              <div className="stat-sub">Raw</div>
              <div className="stat accent">{c.raw_alerts}</div>
            </div>
            <div>
              <div className="stat-sub">Clusters</div>
              <div className="stat soft">{c.clusters}</div>
            </div>
            <div>
              <div className="stat-sub">Incidents</div>
              <div className="stat sand">{c.incidents}</div>
            </div>
            <div>
              <div className="stat-sub">Actions</div>
              <div className="stat sage">{c.actions}</div>
            </div>
          </div>
          <div className="chain section-gap">
            {c.pipeline.map((s, i) => (
              <span key={s.name} style={{ display: 'contents' }}>
                {i > 0 && <span className="chain-arrow">→</span>}
                <span className="chain-node">
                  {s.count} {s.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Affected</h3>
          <div className="mono" style={{ color: 'var(--color-1)' }}>
            {affected.data?.origin}
          </div>
          <p style={{ color: 'var(--text-dim)', margin: '8px 0' }}>
            {affected.data?.customer_impact}
          </p>
          <div className="pill hot">{affected.data?.slo_risk}</div>
          <div className="tag-list">
            {(affected.data?.services ?? []).map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Next</h3>
          <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{next.data?.summary}</p>
          {(next.data?.items ?? []).slice(0, 4).map((item) => (
            <div key={item.title} style={{ marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{item.title}</strong>
                <span className={`badge ${item.urgency === 'now' ? 'high' : 'med'}`}>
                  {item.urgency}
                </span>
              </div>
              <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                {item.entity_id} · {item.eta}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Getting worse</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>p99 Δ</th>
                <th>Score</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {(worse.data?.entities ?? []).map((e) => (
                <tr key={e.entity_id}>
                  <td className="mono">{e.name}</td>
                  <td className="mono" style={{ color: 'var(--color-1)' }}>
                    {delta(e.p99_delta)}
                  </td>
                  <td className="mono">{e.score.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${e.level === 'HIGH' ? 'high' : 'med'}`}>{e.level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Optimize</h3>
          <div className="stat sage">
            ${optimize.data?.total_monthly_save_usd.toLocaleString() ?? 0}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-mute)' }}>/mo</span>
          </div>
          {(optimize.data?.opportunities ?? []).map((o) => (
            <div key={o.title} style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700 }}>{o.title}</div>
              <div className="mono" style={{ color: 'var(--text-mute)' }}>
                {o.category} · {o.entity_id}
                {o.save_usd > 0 ? ` · $${o.save_usd.toLocaleString()}` : ''}
              </div>
              <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{o.rationale}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card section-gap">
        <h3>Fix plan</h3>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Action</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {(fix.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="priority">P{a.priority}</td>
                <td>
                  <strong>{a.title}</strong>
                  <div className="mono" style={{ color: 'var(--text-mute)' }}>
                    {a.rationale}
                  </div>
                </td>
                <td className="mono" style={{ color: 'var(--color-1)' }}>
                  {a.impact}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c && (
        <div className="card section-gap">
          <h3>Clusters</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Cluster</th>
                <th>Alerts</th>
                <th>Sev</th>
              </tr>
            </thead>
            <tbody>
              {c.clusters_detail.map((cl) => (
                <tr key={cl.id}>
                  <td>
                    {cl.title}
                    <div className="mono" style={{ color: 'var(--text-mute)' }}>
                      {cl.entity_ids.join(' · ')}
                    </div>
                  </td>
                  <td className="mono">{cl.alert_count}</td>
                  <td>
                    <span
                      className={`badge ${cl.severity === 'critical' || cl.severity === 'high' ? 'high' : 'med'}`}
                    >
                      {cl.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {affected.data && (
        <div className="stat-sub section-gap">
          Blast {affected.data.blast.services} svc · {affected.data.blast.pods} pods ·{' '}
          {pct(affected.data.blast.request_pct)} traffic
        </div>
      )}
    </LoadState>
  );
}
