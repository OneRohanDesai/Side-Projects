import { api } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Plugins() {
  const { data, loading, error } = useApi(() => api.plugins(), []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Plugins" topic="plugins" />

      <div className="grid grid-3">
        {(data ?? []).map((p) => (
          <div className="card" key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>{p.edition}</h3>
              <span className={`badge ${p.status === 'ready' ? 'low' : 'med'}`}>{p.status}</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{p.name}</div>
            <div className="mono" style={{ color: 'var(--text-mute)' }}>
              v{p.version}
            </div>
            <div className="tag-list">
              {p.capabilities.map((c) => (
                <span className="tag" key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadState>
  );
}
