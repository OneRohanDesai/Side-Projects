/**
 * Optional: inject a realistic incident from observed shop stats into VERITAS.
 * Run after ship has been sending for a bit, or anytime.
 */
import { VERITAS_URL, SHOP_URL, SERVICE } from './config.js';

const entity = `svc:${SERVICE}`;

// Generate a burst of checkout traffic
for (let i = 0; i < 25; i++) {
  await fetch(`${SHOP_URL}/api/checkout`, { method: 'POST', body: '{}' }).catch(() => {});
}

const stats = await (await fetch(`${SHOP_URL}/api/stats`)).json();
const p99 = stats.latency_p99_ms || 200;
const delta = Math.min(0.95, Math.max(0.2, (p99 - 30) / 150));

const res = await fetch(`${VERITAS_URL}/v1/projects/event`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    kind: 'metric_alert',
    metric_alert: {
      entity_id: entity,
      title: `${SERVICE} checkout latency elevated (p99 ${p99.toFixed(0)}ms)`,
      metric: 'http_request_duration_ms_p99',
      value: p99,
      delta,
      root_cause: 'Slow checkout path under load · payment upstream jitter',
      recommended_action: 'Inspect payment-stub latency and checkout DB path',
    },
  }),
});

console.log('Incident event:', await res.json());
console.log(`Open VERITAS UI → Why / Intel · entity ${entity}`);
