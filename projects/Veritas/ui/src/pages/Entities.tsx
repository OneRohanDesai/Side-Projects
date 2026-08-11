import { Link } from 'react-router-dom';
import { api, pct } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Entities() {
  const { data, loading, error } = useApi(() => api.entities(), []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Entities" topic="entities" />

      <div className="grid grid-3">
        {(data ?? []).map((e) => (
          <div className="card" key={e.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>{e.kind}</h3>
              <span
                className="mono"
                style={{ color: e.health < 0.8 ? 'var(--color-1)' : 'var(--color-5)' }}
              >
                {pct(e.health)}
              </span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{e.name}</div>
            <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
              {e.id}
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${e.health < 0.8 ? 'danger' : 'sage'}`}
                style={{ width: pct(e.health) }}
              />
            </div>
            <div className="tag-list">
              {Object.entries(e.labels)
                .slice(0, 4)
                .map(([k, v]) => (
                  <span className="tag" key={k}>
                    {k}:{v}
                  </span>
                ))}
            </div>
            {e.kind === 'service' && (
              <div className="btn-row section-gap">
                <Link className="btn btn-primary" to="/why">
                  Why
                </Link>
                <Link className="btn" to="/archaeology">
                  Archaeology
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </LoadState>
  );
}
