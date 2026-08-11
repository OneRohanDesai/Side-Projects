/**
 * Register ACME Shop topology with VERITAS (live project, not dummy data).
 */
import { VERITAS_URL, PROJECT, SERVICE } from './config.js';

const entities = [
  {
    id: `svc:${SERVICE}`,
    kind: 'service',
    name: SERVICE,
    health: 1.0,
    labels: { project: PROJECT, env: 'local', team: 'commerce', language: 'node' },
    attributes: {
      version: '1.2.0',
      port: 8090,
      repo: 'Test_Project',
    },
  },
  {
    id: 'svc:payment-stub',
    kind: 'service',
    name: 'payment-stub',
    health: 0.98,
    labels: { project: PROJECT, env: 'local', team: 'commerce' },
    attributes: { version: '0.9.0', role: 'dependency' },
  },
  {
    id: 'db:orders-local',
    kind: 'database',
    name: 'orders-local',
    health: 0.97,
    labels: { project: PROJECT, engine: 'sqlite-sim', env: 'local' },
    attributes: {},
  },
  {
    id: 'cache:session-local',
    kind: 'database',
    name: 'session-local',
    health: 0.99,
    labels: { project: PROJECT, engine: 'memory', env: 'local' },
    attributes: {},
  },
  {
    id: 'host:local-dev',
    kind: 'host',
    name: 'local-dev',
    health: 0.95,
    labels: { project: PROJECT, os: 'linux' },
    attributes: {},
  },
  {
    id: 'repo:Test_Project',
    kind: 'repository',
    name: 'Test_Project',
    health: 1.0,
    labels: { project: PROJECT, vcs: 'local' },
    attributes: { path: process.env.HOME + '/Test_Project' },
  },
];

const edges = [
  { id: 'e1', from: `svc:${SERVICE}`, to: 'svc:payment-stub', type: 'calls', weight: 0.9, observed: true },
  { id: 'e2', from: `svc:${SERVICE}`, to: 'db:orders-local', type: 'uses', weight: 0.95, observed: true },
  { id: 'e3', from: `svc:${SERVICE}`, to: 'cache:session-local', type: 'uses', weight: 0.8, observed: true },
  { id: 'e4', from: `svc:${SERVICE}`, to: 'host:local-dev', type: 'runs_on', weight: 1.0, observed: true },
  { id: 'e5', from: `svc:${SERVICE}`, to: 'repo:Test_Project', type: 'produced_by', weight: 1.0, observed: true },
];

const body = {
  project: PROJECT,
  narrative: `Live project ${PROJECT} · service ${SERVICE}`,
  entities,
  edges,
};

const res = await fetch(`${VERITAS_URL}/v1/projects/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error('register failed', res.status, await res.text());
  process.exit(1);
}

const out = await res.json();
console.log('VERITAS project registered:', out);

// Record deploy change for What Changed
await fetch(`${VERITAS_URL}/v1/projects/event`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    kind: 'change',
    change: {
      id: `chg:deploy-${Date.now()}`,
      kind: 'deployment',
      entity_id: `svc:${SERVICE}`,
      summary: `${SERVICE} started locally · v1.2.0`,
      from_version: null,
      to_version: '1.2.0',
      occurred_at: new Date().toISOString(),
      source: 'local-dev',
      correlation: 0.4,
    },
  }),
});

console.log('Deploy change recorded.');
