import { useEffect, useState } from 'react';
import { api, pct, type BlastRadiusReport, type GraphStats } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

const KIND_COLOR: Record<string, string> = {
  service: '#FE4365',
  database: '#FC9D9A',
  host: '#F9CDAD',
  node: '#F9CDAD',
  kubernetes_cluster: '#83AF9B',
  namespace: '#83AF9B',
  repository: '#C8C8A9',
  pod: '#FE4365',
  container: '#FC9D9A',
  process: '#F9CDAD',
  network: '#C8C8A9',
  deployment: '#FE4365',
};

function layout(ids: string[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const rings: Record<string, string[]> = {
    core: [],
    data: [],
    runtime: [],
    net: [],
    other: [],
  };
  for (const id of ids) {
    if (id.startsWith('svc:') || id.startsWith('deploy:')) rings.core.push(id);
    else if (id.startsWith('db:') || id.startsWith('cache:') || id.startsWith('bus:'))
      rings.data.push(id);
    else if (
      id.startsWith('pod:') ||
      id.startsWith('ctr:') ||
      id.startsWith('proc:') ||
      id.startsWith('host:') ||
      id.startsWith('node:')
    )
      rings.runtime.push(id);
    else if (id.startsWith('net:')) rings.net.push(id);
    else rings.other.push(id);
  }

  const place = (list: string[], cx: number, cy: number, rx: number, ry: number) => {
    list.forEach((id, i) => {
      const a = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
      pos[id] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
  };

  place(rings.core, 400, 210, 90, 70);
  place(rings.data, 620, 210, 100, 90);
  place(rings.runtime, 180, 210, 120, 140);
  place(rings.net, 400, 360, 160, 40);
  place(rings.other, 400, 60, 140, 30);

  return pos;
}

export function Graph() {
  const graph = useApi(() => api.graph(), []);
  const stats = useApi(() => api.graphStats(), []);
  const [origin, setOrigin] = useState('');
  const [depth, setDepth] = useState(3);

  useEffect(() => {
    if (!origin && graph.data?.nodes?.length) {
      const n =
        graph.data.nodes.find((x) => x.kind === 'service')?.id ?? graph.data.nodes[0].id;
      setOrigin(n);
    }
  }, [graph.data, origin]);

  const blast = useApi(
    () =>
      origin
        ? api.blastRadius(origin, depth)
        : Promise.resolve({
            origin: '',
            depth,
            entities: [],
            by_kind: {},
            services: 0,
            pods: 0,
            hosts: 0,
            databases: 0,
            containers: 0,
            processes: 0,
            network_endpoints: 0,
            estimated_request_pct: 0,
            edges_traversed: [],
            critical_path: [],
          }),
    [origin, depth],
  );

  const pathEnds = (() => {
    const nodes = graph.data?.nodes ?? [];
    const from = nodes.find((n) => n.kind === 'service')?.id;
    const to =
      nodes.find((n) => n.kind === 'database')?.id ??
      nodes.find((n) => n.id !== from)?.id;
    return from && to ? { from, to } : null;
  })();

  const path = useApi(
    () =>
      pathEnds
        ? api.graphPath(pathEnds.from, pathEnds.to)
        : Promise.resolve({ from: '', to: '', found: false, hops: [], edge_types: [] }),
    [pathEnds?.from, pathEnds?.to],
  );

  const loading = graph.loading || stats.loading;
  const error = graph.error || stats.error;

  const nodes = graph.data?.nodes ?? [];
  const edges = graph.data?.edges ?? [];
  const pos = layout(nodes.map((n) => n.id));
  const br: BlastRadiusReport | null = blast.data;
  const st: GraphStats | null = stats.data;
  const blastSet = new Set(br?.entities ?? []);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Graph" topic="graph">
        <span className="pill live">
          {st?.entities ?? nodes.length} nodes · {st?.edges ?? edges.length} edges
        </span>
      </PageHead>

      <div className="grid grid-4">
        <div className="card">
          <h3>Services</h3>
          <div className="stat accent">{st?.by_kind?.service ?? 0}</div>
        </div>
        <div className="card">
          <h3>Pods / ctr</h3>
          <div className="stat soft">
            {(st?.by_kind?.pod ?? 0) + (st?.by_kind?.container ?? 0)}
          </div>
        </div>
        <div className="card">
          <h3>Process / host</h3>
          <div className="stat sand">
            {(st?.by_kind?.process ?? 0) + (st?.by_kind?.host ?? 0) + (st?.by_kind?.node ?? 0)}
          </div>
        </div>
        <div className="card">
          <h3>Network</h3>
          <div className="stat sage">{st?.by_kind?.network ?? 0}</div>
        </div>
      </div>

      <div className="card section-gap">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Blast radius</h3>
          <select
            className="window-select"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
              </option>
            ))}
          </select>
          <select
            className="window-select"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                depth {d}
              </option>
            ))}
          </select>
          {br && (
            <span className="pill hot">
              {br.entities.length} entities · {pct(br.estimated_request_pct)} traffic
            </span>
          )}
        </div>
        {br && (
          <div className="tag-list section-gap">
            <span className="tag">svc {br.services}</span>
            <span className="tag">pods {br.pods}</span>
            <span className="tag">hosts {br.hosts}</span>
            <span className="tag">db {br.databases}</span>
            <span className="tag">ctr {br.containers}</span>
            <span className="tag">proc {br.processes}</span>
            <span className="tag">net {br.network_endpoints}</span>
          </div>
        )}
      </div>

      <div className="graph-canvas section-gap">
        <svg className="graph-svg" viewBox="0 0 780 420">
          {edges.map((e) => {
            const a = pos[e.from] ?? { x: 100, y: 100 };
            const b = pos[e.to] ?? { x: 200, y: 200 };
            const hot = blastSet.has(e.from) && blastSet.has(e.to);
            return (
              <line
                key={e.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={hot ? 'rgba(254,67,101,0.55)' : 'rgba(252,157,154,0.28)'}
                strokeWidth={hot ? 2 : 1}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos[n.id] ?? { x: 100, y: 100 };
            const color = KIND_COLOR[n.kind] ?? '#FE4365';
            const inBlast = blastSet.has(n.id);
            const r = n.id === origin ? 18 : inBlast ? 14 : 10;
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setOrigin(n.id)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r + (inBlast ? 5 : 0)}
                  fill="none"
                  stroke={color}
                  strokeOpacity={inBlast ? 0.45 : 0.2}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="#14080c"
                  stroke={color}
                  strokeWidth={inBlast ? 2.5 : 1.5}
                />
                <text
                  x={p.x}
                  y={p.y + r + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill={color}
                  fontFamily="ui-monospace, monospace"
                >
                  {n.name.length > 16 ? n.name.slice(0, 14) + '…' : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {path.data?.found && (
        <div className="card section-gap">
          <h3>
            Path {path.data.from} → {path.data.to}
          </h3>
          <div className="chain">
            {path.data.hops.map((h, i) => (
              <span key={h} style={{ display: 'contents' }}>
                {i > 0 && <span className="chain-arrow">→</span>}
                <span className="chain-node">{h}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </LoadState>
  );
}
