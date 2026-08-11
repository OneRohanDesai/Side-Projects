import { api, pct, riskClass } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Forecast() {
  const { data, loading, error } = useApi(() => api.forecast(), []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Forecast" topic="forecast" />

      {(data ?? []).length === 0 ? (
        <div className="card">
          <h3>No forecasts yet</h3>
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>
            Ship live metrics from a project (for example Test_Project ship). Capacity and series
            forecasts appear once analytics has history.
          </p>
        </div>
      ) : (
        <div className="grid grid-2">
          {(data ?? []).map((f) => (
            <div className="card" key={f.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{f.resource.replaceAll('_', ' ')}</h3>
                <span className={`badge ${riskClass(f.risk)}`}>{f.risk}</span>
              </div>
              <div className="mono" style={{ color: 'var(--text-mute)', marginBottom: 8 }}>
                {f.entity_id}
              </div>
              <div className="stat accent">{pct(f.utilization)}</div>
              <div className="bar-track">
                <div
                  className={`bar-fill ${f.utilization > 0.7 ? 'danger' : f.utilization > 0.5 ? 'warn' : 'sage'}`}
                  style={{ width: pct(f.utilization) }}
                />
              </div>
              <div className="stat-sub">
                {f.days_to_saturation != null
                  ? `~${f.days_to_saturation} days to risk`
                  : 'No near term risk'}
              </div>
              <div style={{ marginTop: 12, color: 'var(--text-dim)' }}>{f.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </LoadState>
  );
}
