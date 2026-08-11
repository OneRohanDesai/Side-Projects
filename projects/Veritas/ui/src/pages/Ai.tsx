import { useState } from 'react';
import { api, type Explanation } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

const KINDS = [
  { id: 'why', label: 'Why' },
  { id: 'changed', label: 'Changed' },
  { id: 'affected', label: 'Affected' },
  { id: 'next', label: 'Next' },
  { id: 'compress', label: 'Compress' },
  { id: 'worse', label: 'Worse' },
  { id: 'optimize', label: 'Optimize' },
];

export function Ai() {
  const status = useApi(() => api.aiStatus(), []);
  const [kind, setKind] = useState('why');
  const [mode, setMode] = useState('deterministic');
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const e = await api.aiExplainKind(kind, undefined, mode);
      setExplanation(e);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoadState loading={status.loading} error={status.error}>
      <PageHead title="AI" topic="ai">
        <span className="pill live">{status.data?.mode ?? '·'}</span>
      </PageHead>

      <div className="grid grid-3">
        <div className="card">
          <h3>Mode</h3>
          <div className="stat soft mono">{String(status.data?.mode ?? '·')}</div>
          <div className="stat-sub">{status.data?.principle}</div>
        </div>
        <div className="card">
          <h3>Local</h3>
          <div className={`stat ${status.data?.local_reachable ? 'sage' : 'sand'}`}>
            {status.data?.local_reachable ? 'UP' : 'DOWN'}
          </div>
          <div className="mono stat-sub">{status.data?.local_endpoint}</div>
        </div>
        <div className="card">
          <h3>Cloud</h3>
          <div className={`stat ${status.data?.cloud_configured ? 'soft' : 'sand'}`}>
            {status.data?.cloud_configured ? 'CFG' : 'OFF'}
          </div>
          <div className="stat-sub">Optional · air gap safe default</div>
        </div>
      </div>

      <div className="card section-gap">
        <h3>Explain facts</h3>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`btn ${kind === k.id ? 'btn-primary' : ''}`}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <select className="window-select" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="deterministic">deterministic</option>
            <option value="local">local</option>
            <option value="cloud">cloud</option>
            <option value="off">off</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Explaining…' : 'Explain'}
          </button>
        </div>
        {err && (
          <div className="error-box section-gap" style={{ padding: 12, textAlign: 'left' }}>
            {err}
          </div>
        )}
      </div>

      {explanation && (
        <div className="card section-gap">
          <h3>{explanation.title}</h3>
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <span className="pill live">{explanation.mode}</span>
            {explanation.model && <span className="pill">{explanation.model}</span>}
            <span className="pill ok">{explanation.facts_id}</span>
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 0 }}>{explanation.summary}</p>
          {explanation.sections.map((s) => (
            <div key={s.heading} className="help-block" style={{ marginTop: 12 }}>
              <h4>{s.heading}</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{s.body}</p>
            </div>
          ))}
          {explanation.caveats.length > 0 && (
            <div className="section-gap">
              {explanation.caveats.map((c) => (
                <div key={c} className="stat-sub">
                  · {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </LoadState>
  );
}
