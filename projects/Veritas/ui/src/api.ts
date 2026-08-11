const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:7420';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export type Overview = {
  health: number;
  entities: number;
  active_incidents: number;
  open_actions: number;
  meaningful_changes_24h: number;
  related_to_degradation: number;
};

export type Entity = {
  id: string;
  kind: string;
  name: string;
  health: number;
  labels: Record<string, string>;
  attributes: Record<string, unknown>;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  type: string;
  weight: number;
  observed: boolean;
};

export type Change = {
  id: string;
  kind: string;
  entity_id: string;
  summary: string;
  from_version?: string | null;
  to_version?: string | null;
  occurred_at: string;
  source: string;
  correlation: number;
};

export type WhatChanged = {
  window: string;
  meaningful_changes: number;
  related_to_degradation: number;
  primary?: Change;
  changes: Change[];
  observed_after: string[];
  causal_chain: string[];
  incident?: Incident;
};

export type Incident = {
  id: string;
  title: string;
  status: string;
  confidence: number;
  root_cause: string;
  blast_radius: { services: number; pods: number; request_pct: number };
  recommended_action: string;
  expected_impact: string;
  started_at: string;
  timeline: { at: string; event: string; entity_id: string }[];
  causal_chain: string[];
};

export type WhyAnalysis = {
  what: string;
  when: string;
  where_entity: string;
  what_changed: string[];
  depends_on: string[];
  affected: { services: number; pods: number; request_pct: number };
  possible_causes: { summary: string; probability: number; change_id?: string }[];
  recommended_action: string;
  expected_impact: string;
  confidence: number;
  causal_chain: string[];
  timeline: { at: string; event: string; entity_id: string }[];
  evidence: {
    id: string;
    entity_id: string;
    name: string;
    value: number;
    unit: string;
    delta: number;
    observed_at: string;
    severity: string;
  }[];
};

export type Forecast = {
  id: string;
  entity_id: string;
  resource: string;
  utilization: number;
  days_to_saturation: number | null;
  risk: string;
  recommendation: string;
};

export type Action = {
  id: string;
  priority: number;
  title: string;
  rationale: string;
  entity_id: string;
  impact: string;
};

export type DailyReport = {
  date: string;
  overall_health: number;
  changes: Record<string, number>;
  anomalies_detected: number;
  high_significance: number;
  potential_incidents: number;
  performance_degradation: string;
  capacity_concern: string;
  security_concern: string;
  cost_opportunity_usd: number;
  recommended_actions: string[];
};

export type Archaeology = {
  entity_id: string;
  entity_name: string;
  window: string;
  performance: Record<string, number>;
  errors_delta: number;
  cpu_delta: number;
  memory_delta: number;
  database_query_latency_delta: number;
  deployments: number;
  incidents: number;
  likely_degradation: string;
  narrative: string;
};

export type CostInsight = {
  entity_id: string;
  monthly_cost_usd: number;
  cpu_util: number;
  mem_util: number;
  peak_util: number;
  saving_usd: number;
  reliability_risk: string;
  recommendation: string;
};

export type Entitlement = {
  customer_id: string;
  license_id: string;
  edition: string;
  expiry: string;
  max_seats: number;
  max_nodes: number;
  max_agents: number;
  max_storage_gb: number;
  enabled_modules: string[];
  ai_features: string;
  support_level: string;
  signature: string;
  offline?: boolean;
  machine_fingerprint?: string | null;
};

export type LicenseStatus = {
  valid: boolean;
  air_gap_ready: boolean;
  message: string;
  entitlement: Entitlement;
  offline_file?: string | null;
  machine_fingerprint?: string;
  verifying_key_hex?: string;
};

export type Session = {
  token: string;
  user_id: string;
  username: string;
  roles: string[];
  permissions: string[];
  expires_at: string;
  created_at: string;
};

export type UserPublic = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  active: boolean;
  auth_source: string;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
};

export type SsoProvider = {
  id: string;
  name: string;
  protocol: string;
  enabled: boolean;
  issuer: string;
  client_id: string;
  scopes: string[];
  discovery_url: string;
  redirect_uri: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  resource: string;
  detail: string;
  success: boolean;
  prev_hash: string;
  hash: string;
};

export type FleetAgent = {
  agent_id: string;
  host: string;
  version: string;
  status: string;
  labels: Record<string, string>;
  last_seen: string;
  online: boolean;
  registered_at: string;
};

export type HaCluster = {
  cluster_id: string;
  mode: string;
  leader: string;
  quorum: number;
  nodes: { id: string; address: string; role: string; healthy: boolean; last_heartbeat: string }[];
  replication: string;
  notes: string[];
};

export type SignedPack = {
  manifest: {
    id: string;
    name: string;
    version: string;
    kind: string;
    edition: string;
    modules: string[];
    description: string;
    issued_at: string;
  };
  content_hash: string;
  signature: string;
  verified: boolean;
  installed: boolean;
};

export type EnterpriseOverview = {
  users: number;
  roles: number;
  sessions: number;
  audit_events: number;
  agents: number;
  agents_online: number;
  ha_mode: string;
  ha_nodes: number;
  packs: number;
  sso_providers: number;
  air_gap_ready: boolean;
};

export type Plugin = {
  id: string;
  name: string;
  version: string;
  status: string;
  capabilities: string[];
  edition: string;
};

export type Meta = {
  name: string;
  latin: string;
  tagline: string;
  pitch: string;
  philosophy: string;
  version: string;
  phase: string;
};

export type TelemetryStatus = {
  metrics: number;
  logs: number;
  spans: number;
  sources: number;
  metrics_accepted: number;
  logs_accepted: number;
  spans_accepted: number;
  last_ingest: string | null;
};

export type MetricPoint = {
  id: string;
  name: string;
  value: number;
  unit?: string;
  entity_id?: string;
  resource?: string;
  labels?: Record<string, string>;
  observed_at: string;
  source: string;
};

export type LogRecord = {
  id: string;
  body: string;
  severity: string;
  entity_id?: string;
  resource?: string;
  observed_at: string;
  source: string;
};

export type SpanRecord = {
  id: string;
  trace_id: string;
  span_id: string;
  name: string;
  service: string;
  duration_ms: number;
  status: string;
  observed_at: string;
  source: string;
};

export type DiscoveryResult = {
  docker_found: number;
  kubernetes_found: number;
  entities_added: number;
  entities: Entity[];
  notes: string[];
};

export type GraphStats = {
  entities: number;
  edges: number;
  by_kind: Record<string, number>;
  by_edge_type: Record<string, number>;
};

export type BlastRadiusReport = {
  origin: string;
  depth: number;
  entities: string[];
  by_kind: Record<string, number>;
  services: number;
  pods: number;
  hosts: number;
  databases: number;
  containers: number;
  processes: number;
  network_endpoints: number;
  estimated_request_pct: number;
  edges_traversed: { from: string; to: string; edge_type: string; hop: number }[];
  critical_path: string[];
};

export type PathResult = {
  from: string;
  to: string;
  found: boolean;
  hops: string[];
  edge_types: string[];
};

export type AnalyticsStatus = {
  backend: string;
  tables: string[];
  metric_rows: number;
  signal_rows: number;
  entity_rows: number;
  parquet_exports: string[];
  data_dir: string;
};

export type AggregateBucket = {
  bucket: string;
  metric: string;
  entity_id?: string | null;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

export type AnomalyPoint = {
  id: string;
  metric: string;
  entity_id?: string | null;
  value: number;
  mean: number;
  stddev: number;
  z_score: number;
  severity: string;
  observed_at: string;
};

export type SeriesForecast = {
  metric: string;
  entity_id?: string | null;
  slope_per_day: number;
  intercept: number;
  r_squared: number;
  days_to_threshold: number | null;
  threshold: number;
  points: { t: number; value: number; predicted: boolean }[];
  recommendation: string;
};

export type SqlResult = {
  columns: { name: string; type_name: string }[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
};

export type AffectedReport = {
  origin: string;
  incident_id?: string | null;
  services: string[];
  databases: string[];
  pods: string[];
  hosts: string[];
  blast: { services: number; pods: number; request_pct: number };
  customer_impact: string;
  slo_risk: string;
};

export type NextReport = {
  generated_at: string;
  items: {
    entity_id: string;
    kind: string;
    title: string;
    urgency: string;
    eta: string;
    evidence: string;
  }[];
  summary: string;
};

export type GettingWorseReport = {
  window: string;
  entities: {
    entity_id: string;
    name: string;
    score: number;
    p99_delta: number;
    error_delta: number;
    level: string;
  }[];
  worst?: string | null;
};

export type OptimizeReport = {
  opportunities: {
    entity_id: string;
    category: string;
    title: string;
    save_usd: number;
    reliability_risk: string;
    rationale: string;
  }[];
  total_monthly_save_usd: number;
};

export type AlertCompressionReport = {
  raw_alerts: number;
  clusters: number;
  incidents: number;
  root_causes: number;
  actions: number;
  pipeline: { name: string; count: number; note: string }[];
  clusters_detail: {
    id: string;
    title: string;
    alert_count: number;
    entity_ids: string[];
    severity: string;
    linked_incident?: string | null;
  }[];
  recommended_actions: Action[];
};

export type ReportSuite = {
  daily: DailyReport;
  weekly: {
    window: string;
    deployments: number;
    incidents: number;
    mttr_minutes: number;
    error_budget_burn: number;
    top_regressed: string[];
    narrative: string;
  };
  capacity: string;
  cost: string;
  security: string;
  postmortem_draft: string;
  incident: string;
};

export type FactBundle = {
  id: string;
  kind: string;
  facts: unknown;
  generated_at: string;
};

export type Explanation = {
  mode: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  caveats: string[];
  facts_id: string;
  model?: string | null;
};

export type AiStatus = {
  mode: string;
  available_modes: string[];
  local_endpoint: string;
  local_reachable: boolean;
  cloud_configured: boolean;
  principle: string;
};

export const api = {
  meta: () => get<Meta>('/v1/meta'),
  overview: () => get<Overview>('/v1/system/overview'),
  entities: () => get<Entity[]>('/v1/entities'),
  entity: (id: string) =>
    get<{ entity: Entity; dependencies: string[]; why_available: boolean }>(
      `/v1/entities/${encodeURIComponent(id)}`,
    ),
  graph: () => get<{ nodes: Entity[]; edges: Edge[]; stats?: GraphStats }>('/v1/graph'),
  graphStats: () => get<GraphStats>('/v1/graph/stats'),
  blastRadius: (entity: string, depth = 3) =>
    get<BlastRadiusReport>(
      `/v1/graph/blast-radius?entity=${encodeURIComponent(entity)}&depth=${depth}`,
    ),
  graphPath: (from: string, to: string) =>
    get<PathResult>(
      `/v1/graph/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  graphInfer: () => post<{ added_edges: Edge[]; notes: string[] }>('/v1/graph/infer'),
  whatChanged: (window = '1h') =>
    get<WhatChanged>(`/v1/intelligence/what-changed?window=${window}`),
  why: (entity?: string) =>
    get<WhyAnalysis>(
      entity
        ? `/v1/intelligence/why?entity=${encodeURIComponent(entity)}`
        : '/v1/intelligence/why',
    ),
  forecast: () => get<Forecast[]>('/v1/intelligence/forecast'),
  archaeology: (entity?: string) =>
    get<Archaeology>(
      entity
        ? `/v1/intelligence/archaeology?entity=${encodeURIComponent(entity)}`
        : '/v1/intelligence/archaeology',
    ),
  actions: () => get<Action[]>('/v1/intelligence/actions'),
  cost: () => get<CostInsight[]>('/v1/intelligence/cost'),
  dailyReport: () => get<DailyReport>('/v1/reports/daily'),
  incidents: () => get<Incident[]>('/v1/incidents'),
  plugins: () => get<Plugin[]>('/v1/plugins'),
  health: () => get<{ status: string }>('/health'),
  telemetryStatus: () => get<TelemetryStatus>('/v1/telemetry/status'),
  telemetryMetrics: () => get<MetricPoint[]>('/v1/telemetry/metrics'),
  telemetryLogs: () => get<LogRecord[]>('/v1/telemetry/logs'),
  telemetryTraces: () => get<SpanRecord[]>('/v1/telemetry/traces'),
  discovery: () => get<DiscoveryResult>('/v1/discovery'),
  discoveryScan: () => post<DiscoveryResult>('/v1/discovery/scan'),
  affected: (entity?: string) =>
    get<AffectedReport>(
      entity
        ? `/v1/intelligence/affected?entity=${encodeURIComponent(entity)}`
        : '/v1/intelligence/affected',
    ),
  next: () => get<NextReport>('/v1/intelligence/next'),
  fixPlan: () => get<Action[]>('/v1/intelligence/fix'),
  gettingWorse: () => get<GettingWorseReport>('/v1/intelligence/getting-worse'),
  optimize: () => get<OptimizeReport>('/v1/intelligence/optimize'),
  compress: () => get<AlertCompressionReport>('/v1/intelligence/compress'),
  reportSuite: () => get<ReportSuite>('/v1/reports/suite'),
  facts: (kind = 'why', entity?: string) => {
    const q = new URLSearchParams({ kind });
    if (entity) q.set('entity', entity);
    return get<FactBundle>(`/v1/intelligence/facts?${q}`);
  },
  aiStatus: () => get<AiStatus>('/v1/ai/status'),
  aiExplainKind: (kind: string, entity?: string, mode?: string) => {
    const q = new URLSearchParams();
    if (entity) q.set('entity', entity);
    if (mode) q.set('mode', mode);
    const qs = q.toString();
    return get<Explanation>(`/v1/ai/explain/${encodeURIComponent(kind)}${qs ? `?${qs}` : ''}`);
  },
  enterpriseOverview: () => get<EnterpriseOverview>('/v1/enterprise/overview'),
  login: (username: string, password: string) =>
    post<Session>('/v1/auth/login', { username, password }),
  logout: (token: string) => post<{ logged_out: boolean }>('/v1/auth/logout', { token }),
  me: (token: string) => get<Session>(`/v1/auth/me?token=${encodeURIComponent(token)}`),
  ssoProviders: () => get<SsoProvider[]>('/v1/auth/sso'),
  ssoToggle: (id: string, enabled: boolean) =>
    post<{ id: string; enabled: boolean }>('/v1/auth/sso/toggle', { id, enabled }),
  users: () => get<UserPublic[]>('/v1/users'),
  rbacRoles: () => get<Role[]>('/v1/rbac/roles'),
  rbacAssignments: () => get<Record<string, string[]>>('/v1/rbac/assignments'),
  audit: (limit = 50) => get<AuditEvent[]>(`/v1/audit?limit=${limit}`),
  auditVerify: () => get<{ chain_valid: boolean }>('/v1/audit/verify'),
  fleetAgents: () => get<FleetAgent[]>('/v1/fleet/agents'),
  fleetHeartbeat: (hb: {
    agent_id: string;
    host: string;
    version: string;
    status: string;
    labels?: Record<string, string>;
  }) => post<FleetAgent>('/v1/fleet/heartbeat', hb),
  ha: () => get<HaCluster>('/v1/ha'),
  haEnable: (peer_address: string) =>
    post<HaCluster>('/v1/ha/enable', { peer_address }),
  packs: () => get<SignedPack[]>('/v1/packs'),
  packsMint: (name: string, kind: string, modules: string[]) =>
    post<SignedPack>('/v1/packs/mint', { name, kind, modules }),
  license: () => get<LicenseStatus>('/v1/license'),
  licenseMint: (customer_id: string, bind_machine = true) =>
    post<Entitlement>('/v1/license/mint', { customer_id, bind_machine }),
  licenseInstallJson: (license_json: string) =>
    post<LicenseStatus>('/v1/license/install', { license_json }),
  analyticsStatus: () => get<AnalyticsStatus>('/v1/analytics/status'),
  analyticsSql: (query: string) => post<SqlResult>('/v1/analytics/sql', { query }),
  analyticsAggregate: (metric?: string) =>
    get<AggregateBucket[]>(
      metric
        ? `/v1/analytics/aggregate?metric=${encodeURIComponent(metric)}`
        : '/v1/analytics/aggregate',
    ),
  analyticsAnomalies: (z = 2) => get<AnomalyPoint[]>(`/v1/analytics/anomalies?z=${z}`),
  analyticsForecast: (
    metric = 'http_request_duration_ms_p99',
    entity?: string,
    threshold = 500,
    horizon = 14,
  ) => {
    const q = new URLSearchParams({
      metric,
      threshold: String(threshold),
      horizon: String(horizon),
    });
    if (entity) q.set('entity', entity);
    return get<SeriesForecast>(`/v1/analytics/forecast?${q}`);
  },
  analyticsExport: (table = 'metrics') =>
    post<{ table: string; path: string }>('/v1/analytics/export/parquet', { table }),
};

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function delta(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(0)}%`;
}

export function riskClass(risk: string) {
  const r = risk.toLowerCase();
  if (r === 'critical' || r === 'high') return 'risk-high';
  if (r === 'warn' || r === 'medium') return 'risk-med';
  return 'risk-low';
}
