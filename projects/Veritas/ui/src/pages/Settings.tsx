import { api } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Settings() {
  const license = useApi(() => api.license(), []);
  const meta = useApi(() => api.meta(), []);
  const loading = license.loading || meta.loading;
  const error = license.error || meta.error;
  const e = license.data?.entitlement;

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Settings" topic="settings">
        <span className="pill ok">{meta.data?.phase}</span>
      </PageHead>

      <div className="grid grid-2">
        <div className="card">
          <h3>Product</h3>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-1)' }}>
            {meta.data?.name}
          </div>
          <p style={{ color: 'var(--text-dim)', margin: '8px 0 0' }}>{meta.data?.tagline}</p>
          <div className="mono section-gap" style={{ color: 'var(--color-2)' }}>
            v{meta.data?.version}
          </div>
        </div>

        <div className="card">
          <h3>License</h3>
          <div className="stat soft" style={{ textTransform: 'uppercase' }}>
            {e?.edition}
          </div>
          <div className="grid grid-3 section-gap" style={{ gap: 8 }}>
            <div>
              <div className="stat-sub">Seats</div>
              <div className="mono">{e?.max_seats}</div>
            </div>
            <div>
              <div className="stat-sub">Nodes</div>
              <div className="mono">{e?.max_nodes}</div>
            </div>
            <div>
              <div className="stat-sub">Agents</div>
              <div className="mono">{e?.max_agents}</div>
            </div>
          </div>
          <div className="section-gap">
            <span className={`pill ${license.data?.air_gap_ready ? 'ok' : 'hot'}`}>
              {license.data?.air_gap_ready ? 'AIR GAP READY' : 'ONLINE'}
            </span>
          </div>
          <div className="tag-list">
            {(e?.enabled_modules ?? []).map((m) => (
              <span className="tag" key={m}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </LoadState>
  );
}
