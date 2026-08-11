import { Link } from 'react-router-dom';
import { api, pct } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function CommandDeck() {
  const overview = useApi(() => api.overview(), []);
  const incidents = useApi(() => api.incidents(), []);
  const actions = useApi(() => api.actions(), []);
  const telemetry = useApi(() => api.telemetryStatus(), []);

  const loading = overview.loading || incidents.loading || actions.loading;
  const error = overview.error || incidents.error || actions.error;
  const incident = incidents.data?.[0];

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Command Deck" topic="deck">
        <div className="pill-row">
          <span className="pill live">
            <span className="pulse" /> LOCAL
          </span>
          <span className="pill ok">AIR GAP</span>
          {incident && (
            <span className="pill hot">
              <span className="pulse" /> INCIDENT
            </span>
          )}
        </div>
      </PageHead>

      <div className="grid grid-4">
        <div className="card">
          <h3>Health</h3>
          <div className="stat accent">{pct(overview.data?.health ?? 0)}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: pct(overview.data?.health ?? 0) }} />
          </div>
        </div>
        <div className="card">
          <h3>Changes 24h</h3>
          <div className="stat soft">{overview.data?.meaningful_changes_24h ?? '·'}</div>
          <div className="stat-sub">{overview.data?.related_to_degradation ?? 0} linked</div>
        </div>
        <div className="card">
          <h3>Decisions</h3>
          <div className="stat sand">{overview.data?.open_actions ?? '·'}</div>
        </div>
        <div className="card">
          <h3>Entities</h3>
          <div className="stat sage">{overview.data?.entities ?? '·'}</div>
          {telemetry.data && (
            <div className="stat-sub">
              {telemetry.data.metrics} metrics · {telemetry.data.logs} logs · {telemetry.data.spans} spans
            </div>
          )}
        </div>
      </div>

      <div className="hero-action section-gap">
        <div className={`card ${incident ? 'incident-banner' : ''}`}>
          <h3>Incident</h3>
          {incident ? (
            <>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>
                {incident.title}
              </div>
              <div className="mono" style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
                {pct(incident.confidence)} · {incident.root_cause}
              </div>
              <div className="pill-row" style={{ marginBottom: 14 }}>
                <span className="pill hot">
                  {incident.blast_radius.services} services · {incident.blast_radius.pods} pods ·{' '}
                  {pct(incident.blast_radius.request_pct)} traffic
                </span>
              </div>
              <div className="btn-row">
                <Link className="btn btn-primary" to="/why">
                  Why
                </Link>
                <Link className="btn" to="/what-changed">
                  What changed
                </Link>
                <Link className="btn btn-ghost" to="/actions">
                  Fix
                </Link>
              </div>
            </>
          ) : (
            <div className="stat-sub">None active</div>
          )}
        </div>

        <div className="card">
          <h3>Shortcuts</h3>
          <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <Link className="btn btn-primary" to="/what-changed">
              What changed
            </Link>
            <Link className="btn" to="/forecast">
              Forecast
            </Link>
            <Link className="btn" to="/telemetry">
              Telemetry
            </Link>
            <Link className="btn btn-ghost" to="/reports">
              Report
            </Link>
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <h3>Actions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Action</th>
              <th>Why</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {(actions.data ?? []).slice(0, 4).map((a) => (
              <tr key={a.id}>
                <td className="priority">P{a.priority}</td>
                <td>
                  <strong>{a.title}</strong>
                  <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                    {a.entity_id}
                  </div>
                </td>
                <td style={{ color: 'var(--text-dim)' }}>{a.rationale}</td>
                <td className="mono" style={{ color: 'var(--color-1)' }}>
                  {a.impact}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LoadState>
  );
}
