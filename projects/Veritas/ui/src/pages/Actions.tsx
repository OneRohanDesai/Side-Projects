import { api } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Actions() {
  const { data, loading, error } = useApi(() => api.actions(), []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Actions" topic="actions" />

      <div className="grid">
        {(data ?? []).map((a) => (
          <div className="card" key={a.id}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div className="stat accent" style={{ fontSize: '1.3rem', minWidth: 48 }}>
                P{a.priority}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{a.title}</div>
                <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                  {a.entity_id}
                </div>
                <p style={{ color: 'var(--text-dim)', margin: '10px 0' }}>{a.rationale}</p>
                <div className="pill ok">{a.impact}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadState>
  );
}
