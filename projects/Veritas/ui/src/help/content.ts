export type HelpTopic = {
  id: string;
  title: string;
  lead: string;
  blocks: { heading: string; body?: string; bullets?: string[] }[];
};

export const HELP: Record<string, HelpTopic> = {
  deck: {
    id: 'deck',
    title: 'Command Deck',
    lead: 'Live pulse of the system model. Start here when something feels wrong.',
    blocks: [
      {
        heading: 'Signals',
        bullets: [
          'Health is a rollup across modeled entities',
          'Changes counts meaningful deltas not raw events',
          'Decisions are compressed actions not alert spam',
        ],
      },
      {
        heading: 'Incident strip',
        body: 'Active incident shows confidence, blast radius, and deep links into Why and What Changed.',
      },
      {
        heading: 'Next step',
        body: 'Open Why for root cause or What Changed for the ranked delta list.',
      },
    ],
  },
  whatChanged: {
    id: 'whatChanged',
    title: 'What Changed',
    lead: 'Ranks deploys, config, infra, and correlated signals in a time window.',
    blocks: [
      {
        heading: 'Primary change',
        body: 'Highest correlation with current degradation. Follow the causal chain downward.',
      },
      {
        heading: 'Correlation',
        body: 'Score from 0 to 1. Above 0.7 usually matters for the active incident.',
      },
      {
        heading: 'Window',
        body: 'Narrow for live fire. Widen for archaeology of recent ship days.',
      },
    ],
  },
  why: {
    id: 'why',
    title: 'Why Engine',
    lead: 'First class root cause path: what, when, where, evidence, probability, action.',
    blocks: [
      {
        heading: 'Timeline',
        body: 'Ordered facts the engine used. Deploy usually leads the chain when correlation is high.',
      },
      {
        heading: 'Causes',
        body: 'Hypotheses ranked by probability. The top bar is the working theory.',
      },
      {
        heading: 'Action',
        body: 'Recommended move with expected impact. Deterministic analytics first. Language models optional later.',
      },
    ],
  },
  forecast: {
    id: 'forecast',
    title: 'Forecast',
    lead: 'Capacity and saturation outlook. Moves you from monitoring to prediction.',
    blocks: [
      {
        heading: 'Utilization',
        body: 'Current level of the resource on the linked entity.',
      },
      {
        heading: 'Days to risk',
        body: 'When growth reaches a concern threshold at the current rate. Empty means no near term issue.',
      },
      {
        heading: 'Risk labels',
        body: 'High needs a plan. Low or none is informational.',
      },
    ],
  },
  graph: {
    id: 'graph',
    title: 'System Graph',
    lead: 'Phase 4 intelligence graph. Host process container pod service database network and more.',
    blocks: [
      {
        heading: 'Blast radius',
        body: 'Pick an origin and depth. Highlighted nodes are within impact hop distance.',
      },
      {
        heading: 'Edges',
        bullets: [
          'calls runtime hop',
          'uses resource dependency',
          'deployed on placement',
          'runs on host',
          'contains ownership',
          'exposes network',
        ],
      },
      {
        heading: 'Path',
        body: 'Shortest undirected path between two entities for causal storytelling.',
      },
    ],
  },
  entities: {
    id: 'entities',
    title: 'Entities',
    lead: 'Services, data stores, hosts, clusters in the intelligence graph.',
    blocks: [
      {
        heading: 'Cards',
        body: 'Kind, name, health, labels. Investigate opens Why when an incident touches the entity.',
      },
    ],
  },
  archaeology: {
    id: 'archaeology',
    title: 'Archaeology',
    lead: 'Slow degradation over weeks. Answers what has been getting worse.',
    blocks: [
      {
        heading: 'Window',
        body: 'Default sample uses thirty days of rollups for the selected service.',
      },
      {
        heading: 'Degradation',
        body: 'HIGH means compounding latency and errors. Not a single spike.',
      },
    ],
  },
  reports: {
    id: 'reports',
    title: 'Reports',
    lead: 'Autonomous engineering reports from the analytical engine.',
    blocks: [
      {
        heading: 'Truth source',
        body: 'Numbers come from analytics. Optional AI may only narrate later. Never invents KPIs.',
      },
    ],
  },
  actions: {
    id: 'actions',
    title: 'Actions',
    lead: 'Alert compression into ordered engineering decisions.',
    blocks: [
      {
        heading: 'Priority',
        body: 'P1 first. Each row is a decision with rationale and expected impact.',
      },
    ],
  },
  cost: {
    id: 'cost',
    title: 'Cost Intelligence',
    lead: 'Efficiency view: spend times utilization times reliability risk.',
    blocks: [
      {
        heading: 'Right size',
        body: 'Savings appear only when reliability risk is acceptable. Active incidents block cuts.',
      },
    ],
  },
  telemetry: {
    id: 'telemetry',
    title: 'Telemetry',
    lead: 'Phase 2 fabric. Ingest OpenTelemetry and Prometheus. Browse metrics, logs, traces.',
    blocks: [
      {
        heading: 'Ingest paths',
        bullets: [
          'OTLP HTTP metrics logs traces under the v1 otel routes',
          'Prometheus JSON write under the v1 ingest prometheus route',
          'Discovery scan for Docker and Kubernetes when available',
        ],
      },
      {
        heading: 'Status',
        body: 'Counters show accepted points since process start. Fabric starts empty until collectors ship data.',
      },
    ],
  },
  intelligence: {
    id: 'intelligence',
    title: 'Intelligence',
    lead: 'Phase 5 product surface. Compression, affected, next, worse, optimize, fix.',
    blocks: [
      {
        heading: 'Alert compression',
        body: '500 alerts become clusters, incidents, root causes, then ranked actions.',
      },
      {
        heading: 'Affected',
        body: 'Blast and customer impact for the origin entity.',
      },
      {
        heading: 'Next',
        body: 'Horizon of incident, capacity, and security items by urgency.',
      },
      {
        heading: 'Optimize',
        body: 'Efficiency only when reliability risk is acceptable.',
      },
    ],
  },
  ai: {
    id: 'ai',
    title: 'AI',
    lead: 'Phase 6. Facts first. Models only explain. Deterministic always works offline.',
    blocks: [
      {
        heading: 'Modes',
        bullets: [
          'deterministic template over fact bundles',
          'local Ollama when reachable',
          'cloud optional and off by default',
        ],
      },
      {
        heading: 'Safety',
        body: 'No raw log oceans. Structured facts only. Air gap safe with deterministic mode.',
      },
    ],
  },
  analytics: {
    id: 'analytics',
    title: 'Analytics',
    lead: 'Phase 3 DuckDB hot path. SQL, aggregates, anomalies, series forecast, Parquet export.',
    blocks: [
      {
        heading: 'SQL',
        body: 'Read only SELECT and WITH. Writes are rejected at the API.',
      },
      {
        heading: 'Anomalies',
        body: 'Z score against metric history. High absolute z is significant.',
      },
      {
        heading: 'Forecast',
        body: 'Linear slope on seeded or live series. Days to threshold when slope is positive.',
      },
      {
        heading: 'Parquet',
        body: 'Exports metrics table to the local data directory for offline work.',
      },
    ],
  },
  plugins: {
    id: 'plugins',
    title: 'Plugins',
    lead: 'Connector surface. Collectors feed the fabric. Intelligence stays in the core.',
    blocks: [
      {
        heading: 'Edition',
        body: 'free modules ship in core. pro modules unlock with license packs later.',
      },
    ],
  },
  enterprise: {
    id: 'enterprise',
    title: 'Enterprise',
    lead: 'Phase 7. SSO, RBAC, audit, offline license, fleet, HA, signed packs.',
    blocks: [
      {
        heading: 'Auth',
        body: 'Local users plus OIDC and LDAP provider config. Air gap safe defaults.',
      },
      {
        heading: 'RBAC',
        body: 'Viewer, SRE, Admin roles with permission sets.',
      },
      {
        heading: 'Audit',
        body: 'Append only hash chained events for tamper evidence.',
      },
      {
        heading: 'Fleet and HA',
        body: 'Agent heartbeats and active standby cluster configuration.',
      },
      {
        heading: 'License and packs',
        body: 'Offline signed enterprise license files and verified intelligence packs.',
      },
    ],
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    lead: 'Product identity and entitlement gates.',
    blocks: [
      {
        heading: 'Air gap',
        body: 'Full value without mandatory cloud. Offline licenses for enterprise later.',
      },
      {
        heading: 'Modules',
        body: 'Enabled feature flags from the signed entitlement. Phase 1 uses a free dev license.',
      },
    ],
  },
};
