import { useEffect, useState } from 'react';
import { api, delta } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Archaeology() {
  const entities = useApi(() => api.entities(), []);
  const [entityId, setEntityId] = useState<string>('');

  useEffect(() => {
    if (!entityId && entities.data?.length) {
      const pref =
        entities.data.find((e) => e.kind === 'service')?.id ?? entities.data[0].id;
      setEntityId(pref);
    }
  }, [entities.data, entityId]);

  const arch = useApi(
    () =>
      entityId
        ? api.archaeology(entityId)
        : Promise.resolve({
            entity_id: 'system',
            entity_name: 'system',
            window: 'Live window',
            performance: {},
            errors_delta: 0,
            cpu_delta: 0,
            memory_delta: 0,
            database_query_latency_delta: 0,
            deployments: 0,
            incidents: 0,
            likely_degradation: 'NONE',
            narrative: 'No entities yet. Register a project to begin.',
          }),
    [entityId],
  );

  const loading = entities.loading || arch.loading;
  const error = entities.error || arch.error;
  const data = arch.data;

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Archaeology" topic="archaeology">
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
        <span className={`pill ${data?.likely_degradation === 'HIGH' ? 'hot' : 'ok'}`}>
          {data?.likely_degradation ?? '·'}
        </span>
      </PageHead>

      <div className="card">
        <h3>
          {data?.window} · {data?.entity_name}
        </h3>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: '70ch', margin: 0 }}>
          {data?.narrative}
        </p>
      </div>

      <div className="grid grid-4 section-gap">
        <div className="card">
          <h3>p50</h3>
          <div className="stat sand">{delta((data?.performance as Record<string, number> | undefined)?.p50 ?? 0)}</div>
        </div>
        <div className="card">
          <h3>p95</h3>
          <div className="stat soft">{delta((data?.performance as Record<string, number> | undefined)?.p95 ?? 0)}</div>
        </div>
        <div className="card">
          <h3>p99</h3>
          <div className="stat accent">{delta((data?.performance as Record<string, number> | undefined)?.p99 ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Errors</h3>
          <div className="stat accent">{delta(data?.errors_delta ?? 0)}</div>
        </div>
      </div>

      <div className="grid grid-4 section-gap">
        <div className="card">
          <h3>CPU</h3>
          <div className="stat soft">{delta(data?.cpu_delta ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Memory</h3>
          <div className="stat sand">{delta(data?.memory_delta ?? 0)}</div>
        </div>
        <div className="card">
          <h3>DB latency</h3>
          <div className="stat accent">{delta(data?.database_query_latency_delta ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Ships / incidents</h3>
          <div className="stat">
            {data?.deployments} <span style={{ color: 'var(--text-mute)' }}>/</span>{' '}
            {data?.incidents}
          </div>
        </div>
      </div>
    </LoadState>
  );
}
