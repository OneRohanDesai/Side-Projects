/**
 * Ship live metrics / logs / spans from ACME Shop → VERITAS fabric.
 * Also generates mild traffic against the shop so metrics move.
 */
import { VERITAS_URL, SHOP_URL, SERVICE } from './config.js';

const INTERVAL_MS = Number(process.env.SHIP_INTERVAL_MS || 5000);

async function traffic() {
  try {
    await fetch(`${SHOP_URL}/api/catalog`);
    await fetch(`${SHOP_URL}/api/orders`);
    await fetch(`${SHOP_URL}/api/checkout`, { method: 'POST', body: '{}' });
  } catch {
    // shop may be warming
  }
}

async function scrapeStats() {
  const res = await fetch(`${SHOP_URL}/api/stats`);
  if (!res.ok) throw new Error(`shop stats ${res.status}`);
  return res.json();
}

async function shipOnce() {
  await traffic();
  const s = await scrapeStats();
  const entity = `svc:${SERVICE}`;

  // Prometheus style
  await fetch(`${VERITAS_URL}/v1/ingest/prometheus`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      timeseries: [
        {
          name: 'http_requests_total',
          value: s.requests,
          labels: { service: SERVICE, job: PROJECT_JOB() },
        },
        {
          name: 'http_request_duration_ms_p99',
          value: s.latency_p99_ms,
          labels: { service: SERVICE },
        },
        {
          name: 'http_request_duration_ms_avg',
          value: s.latency_avg_ms,
          labels: { service: SERVICE },
        },
        {
          name: 'http_error_rate',
          value: s.error_rate,
          labels: { service: SERVICE },
        },
      ],
    }),
  });

  // OTel metrics flat
  await fetch(`${VERITAS_URL}/v1/otel/v1/metrics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      metrics: [
        {
          name: 'http_request_duration_ms_p99',
          value: s.latency_p99_ms,
          entity_id: entity,
          unit: 'ms',
        },
        {
          name: 'http_error_rate',
          value: s.error_rate,
          entity_id: entity,
          unit: 'ratio',
        },
      ],
    }),
  });

  // Logs
  const logs = [
    {
      body: `shop scrape · requests=${s.requests} p99=${s.latency_p99_ms.toFixed(1)}ms err=${(s.error_rate * 100).toFixed(2)}%`,
      severity: 'INFO',
      entity_id: entity,
      resource: SERVICE,
    },
  ];
  if (s.last_error) {
    logs.push({
      body: `recent error on ${s.last_error.route}`,
      severity: 'WARN',
      entity_id: entity,
      resource: SERVICE,
    });
  }
  await fetch(`${VERITAS_URL}/v1/otel/v1/logs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ logs }),
  });

  // Spans
  await fetch(`${VERITAS_URL}/v1/otel/v1/traces`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      spans: [
        {
          trace_id: `t${Date.now().toString(16)}`,
          span_id: `s${Math.floor(Math.random() * 1e8).toString(16)}`,
          name: 'POST /api/checkout',
          service: SERVICE,
          duration_ms: s.latency_p99_ms,
          status: s.error_rate > 0.1 ? 'ERROR' : 'OK',
        },
        {
          trace_id: `t${Date.now().toString(16)}`,
          span_id: `s${Math.floor(Math.random() * 1e8).toString(16)}`,
          name: 'GET /api/catalog',
          service: SERVICE,
          duration_ms: Math.max(5, s.latency_avg_ms * 0.4),
          status: 'OK',
        },
      ],
    }),
  });

  // Push signal into intelligence store for compression / why
  const delta =
    s.latency_p99_ms > 100 ? Math.min(0.9, (s.latency_p99_ms - 40) / 200) : 0.05;
  await fetch(`${VERITAS_URL}/v1/projects/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'signal',
      signal: {
        id: '',
        entity_id: entity,
        name: 'http_request_duration_ms_p99',
        value: s.latency_p99_ms,
        unit: 'ms',
        delta,
        observed_at: new Date().toISOString(),
        severity: s.latency_p99_ms > 150 ? 'high' : s.error_rate > 0.08 ? 'warn' : 'info',
      },
    }),
  });

  console.log(
    `[ship] req=${s.requests} p99=${s.latency_p99_ms.toFixed(1)}ms err=${(s.error_rate * 100).toFixed(2)}% → VERITAS`,
  );
}

function PROJECT_JOB() {
  return 'acme-shop';
}

const once = process.argv.includes('--once');

if (once) {
  await shipOnce();
} else {
  console.log(`Shipping ${SHOP_URL} → ${VERITAS_URL} every ${INTERVAL_MS}ms`);
  await shipOnce();
  setInterval(() => {
    shipOnce().catch((e) => console.error('ship error', e.message));
  }, INTERVAL_MS);
}
