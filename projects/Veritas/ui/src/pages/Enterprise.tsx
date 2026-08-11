import { useState } from 'react';
import { api, type Session, type FleetAgent, type AuditEvent, type SignedPack } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

export function Enterprise() {
  const overview = useApi(() => api.enterpriseOverview(), []);
  const users = useApi(() => api.users(), []);
  const roles = useApi(() => api.rbacRoles(), []);
  const sso = useApi(() => api.ssoProviders(), []);
  const audit = useApi(() => api.audit(30), []);
  const fleet = useApi(() => api.fleetAgents(), []);
  const ha = useApi(() => api.ha(), []);
  const packs = useApi(() => api.packs(), []);
  const license = useApi(() => api.license(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('veritas-admin');
  const [msg, setMsg] = useState<string | null>(null);

  const loading =
    overview.loading ||
    users.loading ||
    roles.loading ||
    sso.loading ||
    audit.loading ||
    fleet.loading ||
    ha.loading ||
    packs.loading ||
    license.loading;
  const error =
    overview.error ||
    users.error ||
    roles.error ||
    sso.error ||
    audit.error ||
    fleet.error ||
    ha.error ||
    packs.error ||
    license.error;

  async function doLogin() {
    try {
      const s = await api.login(loginUser, loginPass);
      setSession(s);
      setMsg(`Session ${s.username} · ${s.roles.join(', ')}`);
      audit.setData(await api.audit(30));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function mintLicense() {
    try {
      const ent = await api.licenseMint('acme-corp', true);
      const st = await api.licenseInstallJson(JSON.stringify(ent));
      license.setData(st);
      setMsg(`Enterprise license installed · valid=${st.valid}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function heartbeat() {
    try {
      await api.fleetHeartbeat({
        agent_id: 'agent:demo',
        host: 'demo-host',
        version: '0.7.0',
        status: 'ready',
        labels: { env: 'prod' },
      });
      fleet.setData(await api.fleetAgents());
      setMsg('Fleet heartbeat registered');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function enableHa() {
    try {
      ha.setData(await api.haEnable('127.0.0.1:7421'));
      setMsg('HA active_standby configured');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleSso(id: string, enabled: boolean) {
    await api.ssoToggle(id, enabled);
    sso.setData(await api.ssoProviders());
  }

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Enterprise" topic="enterprise">
        <span className="pill ok">PHASE 7</span>
      </PageHead>

      {msg && (
        <div className="card section-gap">
          <div className="mono">{msg}</div>
        </div>
      )}

      <div className="grid grid-4">
        <div className="card">
          <h3>Users</h3>
          <div className="stat accent">{overview.data?.users ?? 0}</div>
        </div>
        <div className="card">
          <h3>Agents</h3>
          <div className="stat soft">
            {overview.data?.agents_online ?? 0}/{overview.data?.agents ?? 0}
          </div>
        </div>
        <div className="card">
          <h3>Audit</h3>
          <div className="stat sand">{overview.data?.audit_events ?? 0}</div>
        </div>
        <div className="card">
          <h3>Packs</h3>
          <div className="stat sage">{overview.data?.packs ?? 0}</div>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Local auth</h3>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <input
              className="window-select"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              placeholder="user"
            />
            <input
              className="window-select"
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="pass"
            />
            <button type="button" className="btn btn-primary" onClick={doLogin}>
              Login
            </button>
          </div>
          <div className="stat-sub">admin / veritas-admin · sre / veritas-sre · viewer / veritas-viewer</div>
          {session && (
            <div className="section-gap mono" style={{ color: 'var(--color-2)' }}>
              {session.username} · perms {session.permissions.length}
            </div>
          )}
        </div>

        <div className="card">
          <h3>License</h3>
          <div className="stat soft" style={{ textTransform: 'uppercase' }}>
            {String(license.data?.entitlement?.edition ?? '·')}
          </div>
          <div className="stat-sub">{license.data?.message}</div>
          <div className="mono section-gap" style={{ color: 'var(--text-mute)', fontSize: '0.75rem' }}>
            fp {license.data?.machine_fingerprint}
          </div>
          <button type="button" className="btn section-gap" onClick={mintLicense}>
            Mint offline enterprise
          </button>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>SSO providers</h3>
          {(sso.data ?? []).map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="mono" style={{ color: 'var(--text-mute)' }}>
                  {p.protocol} · {p.issuer}
                </div>
              </div>
              <button
                type="button"
                className={`btn ${p.enabled ? 'btn-primary' : ''}`}
                onClick={() => toggleSso(p.id, !p.enabled)}
              >
                {p.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>RBAC roles</h3>
          {(roles.data ?? []).map((r) => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div className="stat-sub">{r.description}</div>
              <div className="tag-list">
                {r.permissions.map((p) => (
                  <span className="tag" key={p}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div className="card">
          <h3>Fleet</h3>
          <button type="button" className="btn btn-primary" onClick={heartbeat}>
            Heartbeat demo agent
          </button>
          <table className="table section-gap">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Host</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(fleet.data as FleetAgent[] | undefined)?.map((a) => (
                <tr key={a.agent_id}>
                  <td className="mono">{a.agent_id}</td>
                  <td className="mono">{a.host}</td>
                  <td>
                    <span className={`badge ${a.online ? 'low' : 'med'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>HA</h3>
          <div className="stat soft mono">{ha.data?.mode}</div>
          <div className="stat-sub">leader {ha.data?.leader}</div>
          <div className="stat-sub">{ha.data?.replication}</div>
          <button type="button" className="btn section-gap" onClick={enableHa}>
            Enable active standby
          </button>
          <div className="tag-list section-gap">
            {(ha.data?.nodes ?? []).map((n) => (
              <span className="tag" key={n.id}>
                {n.role}:{n.address}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <h3>Signed packs</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {(packs.data as SignedPack[] | undefined)?.map((p) => (
              <tr key={p.manifest.id}>
                <td>
                  {p.manifest.name}
                  <div className="mono" style={{ color: 'var(--text-mute)' }}>
                    {p.manifest.id} · v{p.manifest.version}
                  </div>
                </td>
                <td className="mono">{p.manifest.kind}</td>
                <td>
                  <span className={`badge ${p.verified ? 'low' : 'high'}`}>
                    {p.verified ? 'ok' : 'fail'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card section-gap">
        <h3>Audit log</h3>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(audit.data as AuditEvent[] | undefined)?.slice(0, 15).map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ color: 'var(--text-mute)' }}>
                  {new Date(e.at).toLocaleTimeString()}
                </td>
                <td className="mono">{e.actor}</td>
                <td className="mono">{e.action}</td>
                <td style={{ color: e.success ? 'var(--text-dim)' : 'var(--color-1)' }}>
                  {e.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card section-gap">
        <h3>Users</h3>
        <div className="tag-list">
          {(users.data ?? []).map((u) => (
            <span className="tag" key={u.id}>
              {u.username} · {u.auth_source}
            </span>
          ))}
        </div>
      </div>
    </LoadState>
  );
}
