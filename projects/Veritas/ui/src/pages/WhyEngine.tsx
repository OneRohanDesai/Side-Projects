import { useEffect, useState } from 'react';
import { api, pct, delta } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function WhyEngine() {
  const entities = useApi(() => api.entities(), []);
  const [entityId, setEntityId] = useState('');

  useEffect(() => {
    if (!entityId && entities.data?.length) {
      setEntityId(
        entities.data.find((e) => e.kind === 'service')?.id ?? entities.data[0].id,
      );
    }
  }, [entities.data, entityId]);

  const why = useApi(
    () => api.why(entityId || undefined),
    [entityId],
  );

  const loading = entities.loading || why.loading;
  const error = entities.error || why.error;
  const data = why.data;

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Why" topic="why">
        {(entities.data?.length ?? 0) > 0 && (
          <select
            className="window-select"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          >
            {entities.data!.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id}
              </option>
            ))}
          </select>
        )}
        <span className="pill hot">{pct(data?.confidence ?? 0)}</span>
      </PageHead>

      <div className="card incident-banner">
        <h3>What</h3>
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{data?.what}</div>
        <div className="grid grid-3 section-gap">
          <div>
            <h3>When</h3>
            <div className="mono">{data ? new Date(data.when).toLocaleString() : '·'}</div>
          </div>
          <div>
            <h3>Where</h3>
            <div className="mono" style={{ color: 'var(--color-1)' }}>
              {data?.where_entity}
            </div>
          </div>
          <div>
            <h3>Blast</h3>
            <div className="mono">
              {data?.affected.services} svc · {data?.affected.pods} pods ·{' '}
              {pct(data?.affected.request_pct ?? 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Timeline</h3>
          {(data?.timeline ?? []).length === 0 ? (
            <p className="stat-sub">No timeline events.</p>
          ) : (
            <div className="timeline">
              {(data?.timeline ?? []).map((t) => (
                <div className="timeline-item" key={t.at + t.event}>
                  <div className="t">{new Date(t.at).toLocaleTimeString()}</div>
                  <div>{t.event}</div>
                  <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                    {t.entity_id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Causes</h3>
          {(data?.possible_causes ?? []).length === 0 ? (
            <p className="stat-sub">No ranked causes yet.</p>
          ) : (
            (data?.possible_causes ?? []).map((c) => (
              <div key={c.summary} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{c.summary}</span>
                  <span className="mono" style={{ color: 'var(--color-2)' }}>
                    {pct(c.probability)}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${c.probability > 0.8 ? 'danger' : ''}`}
                    style={{ width: pct(c.probability) }}
                  />
                </div>
              </div>
            ))
          )}

          <h3 style={{ marginTop: 16 }}>Chain</h3>
          <div className="chain">
            {(data?.causal_chain ?? []).map((node, i) => (
              <span key={node} style={{ display: 'contents' }}>
                {i > 0 && <span className="chain-arrow">↓</span>}
                <span className="chain-node">{node}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Evidence</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Entity</th>
                <th>Δ</th>
                <th>Sev</th>
              </tr>
            </thead>
            <tbody>
              {(data?.evidence ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.name}</td>
                  <td className="mono" style={{ color: 'var(--text-mute)' }}>
                    {e.entity_id}
                  </td>
                  <td style={{ color: 'var(--color-1)' }}>{delta(e.delta)}</td>
                  <td>
                    <span
                      className={`badge ${e.severity === 'critical' || e.severity === 'high' ? 'high' : 'med'}`}
                    >
                      {e.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Action</h3>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--color-1)',
              margin: '8px 0 12px',
            }}
          >
            {data?.recommended_action}
          </div>
          <div className="stat-sub">Impact</div>
          <div style={{ marginTop: 6 }}>{data?.expected_impact}</div>
          <h3 style={{ marginTop: 18 }}>Depends</h3>
          <div className="tag-list">
            {(data?.depends_on ?? []).map((d) => (
              <span className="tag" key={d}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </LoadState>
  );
}
