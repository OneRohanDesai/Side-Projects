import { api, pct } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Cost() {
  const { data, loading, error } = useApi(() => api.cost(), []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Cost" topic="cost" />

      <div className="grid grid-2">
        {(data ?? []).map((c) => (
          <div className="card" key={c.entity_id}>
            <h3>{c.entity_id}</h3>
            <div className="stat soft">
              ${c.monthly_cost_usd.toLocaleString()}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-mute)' }}>/mo</span>
            </div>
            <div className="grid grid-3 section-gap" style={{ gap: 8 }}>
              <div>
                <div className="stat-sub">CPU</div>
                <div className="mono">{pct(c.cpu_util)}</div>
              </div>
              <div>
                <div className="stat-sub">Mem</div>
                <div className="mono">{pct(c.mem_util)}</div>
              </div>
              <div>
                <div className="stat-sub">Peak</div>
                <div className="mono">{pct(c.peak_util)}</div>
              </div>
            </div>
            <div className="section-gap" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge ${c.reliability_risk === 'HIGH' ? 'high' : 'low'}`}>
                {c.reliability_risk}
              </span>
              {c.saving_usd > 0 && (
                <span className="pill ok">Save ${c.saving_usd.toLocaleString()}/mo</span>
              )}
            </div>
            <p style={{ color: 'var(--text-dim)', marginTop: 12, marginBottom: 0 }}>
              {c.recommendation}
            </p>
          </div>
        ))}
      </div>
    </LoadState>
  );
}
