import { api, type TelemetryStatus } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';
import { useState } from 'react';

export function Telemetry() {
  const status = useApi(() => api.telemetryStatus(), []);
  const metrics = useApi(() => api.telemetryMetrics(), []);
  const logs = useApi(() => api.telemetryLogs(), []);
  const traces = useApi(() => api.telemetryTraces(), []);
  const discovery = useApi(() => api.discovery(), []);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const loading =
    status.loading || metrics.loading || logs.loading || traces.loading || discovery.loading;
  const error =
    status.error || metrics.error || logs.error || traces.error || discovery.error;

  const s: TelemetryStatus | null = status.data;

  async function runScan() {
    setScanning(true);
    setScanMsg(null);
    try {
      const r = await api.discoveryScan();
      setScanMsg(
        `Docker ${r.docker_found} · K8s ${r.kubernetes_found} · entities +${r.entities_added}`,
      );
      status.setData(await api.telemetryStatus());
      discovery.setData(await api.discovery());
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Telemetry" topic="telemetry">
        <button type="button" className="btn" onClick={runScan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Discover'}
        </button>
      </PageHead>

      <div className="grid grid-4">
        <div className="card">
          <h3>Metrics</h3>
          <div className="stat accent">{s?.metrics ?? 0}</div>
          <div className="stat-sub">{s?.metrics_accepted ?? 0} accepted</div>
        </div>
        <div className="card">
          <h3>Logs</h3>
          <div className="stat soft">{s?.logs ?? 0}</div>
          <div className="stat-sub">{s?.logs_accepted ?? 0} accepted</div>
        </div>
        <div className="card">
          <h3>Spans</h3>
          <div className="stat sand">{s?.spans ?? 0}</div>
          <div className="stat-sub">{s?.spans_accepted ?? 0} accepted</div>
        </div>
        <div className="card">
          <h3>Sources</h3>
          <div className="stat sage">{s?.sources ?? 0}</div>
          <div className="stat-sub mono">{s?.last_ingest ?? 'idle'}</div>
        </div>
      </div>

      {scanMsg && (
        <div className="card section-gap">
          <h3>Discovery</h3>
          <div className="mono">{scanMsg}</div>
        </div>
      )}

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Metrics stream</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {(metrics.data ?? []).slice(0, 12).map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.name}</td>
                  <td className="mono" style={{ color: 'var(--color-1)' }}>
                    {m.value}
                  </td>
                  <td className="mono" style={{ color: 'var(--text-mute)' }}>
                    {m.entity_id ?? m.resource}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Logs</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Sev</th>
                <th>Body</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).slice(0, 12).map((l) => (
                <tr key={l.id}>
                  <td>
                    <span
                      className={`badge ${l.severity === 'ERROR' || l.severity === 'FATAL' ? 'high' : 'med'}`}
                    >
                      {l.severity}
                    </span>
                  </td>
                  <td>
                    <div>{l.body}</div>
                    <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                      {l.entity_id ?? l.resource}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section-gap">
        <h3>Traces</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Duration</th>
              <th>Service</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(traces.data ?? []).slice(0, 12).map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.name}</td>
                <td className="mono" style={{ color: 'var(--color-1)' }}>
                  {t.duration_ms}ms
                </td>
                <td className="mono" style={{ color: 'var(--text-mute)' }}>
                  {t.service}
                </td>
                <td>
                  <span className={`badge ${t.status === 'ERROR' ? 'high' : 'low'}`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card section-gap">
        <h3>Discovered</h3>
        <div className="tag-list">
          {(discovery.data?.entities ?? []).length === 0 && (
            <span className="tag">none yet · run Discover</span>
          )}
          {(discovery.data?.entities ?? []).map((e) => (
            <span className="tag" key={e.id}>
              {e.kind}:{e.name}
            </span>
          ))}
        </div>
      </div>
    </LoadState>
  );
}
