/**
 * ACME Shop API + simple shop webpage.
 * No external deps · Node 20+ only.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const PORT = Number(process.env.PORT || 8090);
const SERVICE = 'shop-api';
const VERSION = '1.2.0';

/** In-memory request stats (the "real" system metrics). */
const stats = {
  requests: 0,
  errors: 0,
  latencies: [],
  byRoute: {},
  startedAt: Date.now(),
  lastError: null,
};

/** Simple in-memory orders from the web UI. */
const orders = [
  { id: 'ord_demo1', status: 'shipped' },
  { id: 'ord_demo2', status: 'pending' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function record(route, ms, err = false) {
  stats.requests += 1;
  if (err) {
    stats.errors += 1;
    stats.lastError = { route, at: new Date().toISOString() };
  }
  stats.latencies.push(ms);
  if (stats.latencies.length > 500) stats.latencies.shift();
  if (!stats.byRoute[route]) stats.byRoute[route] = { n: 0, errors: 0, sum: 0 };
  stats.byRoute[route].n += 1;
  stats.byRoute[route].sum += ms;
  if (err) stats.byRoute[route].errors += 1;
}

function p99() {
  if (!stats.latencies.length) return 0;
  const s = [...stats.latencies].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))];
}

function avg() {
  if (!stats.latencies.length) return 0;
  return stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
}

async function work(route) {
  const base = route === '/api/checkout' ? 40 : route === '/api/catalog' ? 12 : 8;
  const jitter = Math.random() * 30;
  const slow = route === '/api/checkout' && Math.random() < 0.08 ? 180 + Math.random() * 120 : 0;
  const ms = base + jitter + slow;
  await new Promise((r) => setTimeout(r, ms));
  return ms;
}

function serveStatic(route, res) {
  let rel = route === '/' ? '/index.html' : route;
  // no path escape
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('forbidden');
    return true;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return false;
  }
  const ext = path.extname(file);
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const route = url.pathname;
  const t0 = Date.now();
  const reqId = randomUUID().slice(0, 8);

  const json = (code, body) => {
    const ms = Date.now() - t0;
    const err = code >= 400;
    record(route, ms, err);
    res.writeHead(code, {
      'content-type': 'application/json',
      'x-request-id': reqId,
      'x-service': SERVICE,
      'x-latency-ms': String(ms),
    });
    res.end(JSON.stringify(body));
  };

  try {
    if (route === '/health') {
      return json(200, {
        status: 'ok',
        service: SERVICE,
        version: VERSION,
        uptime_s: Math.floor((Date.now() - stats.startedAt) / 1000),
      });
    }

    if (route === '/metrics') {
      const errRate = stats.requests ? stats.errors / stats.requests : 0;
      const lines = [
        `# HELP http_requests_total Total HTTP requests`,
        `# TYPE http_requests_total counter`,
        `http_requests_total{service="${SERVICE}"} ${stats.requests}`,
        `# HELP http_errors_total Total HTTP errors`,
        `# TYPE http_errors_total counter`,
        `http_errors_total{service="${SERVICE}"} ${stats.errors}`,
        `# HELP http_request_duration_ms_p99 Request latency p99`,
        `# TYPE http_request_duration_ms_p99 gauge`,
        `http_request_duration_ms_p99{service="${SERVICE}"} ${p99().toFixed(2)}`,
        `# HELP http_request_duration_ms_avg Request latency average`,
        `# TYPE http_request_duration_ms_avg gauge`,
        `http_request_duration_ms_avg{service="${SERVICE}"} ${avg().toFixed(2)}`,
        `# HELP http_error_rate Error ratio`,
        `# TYPE http_error_rate gauge`,
        `http_error_rate{service="${SERVICE}"} ${errRate.toFixed(4)}`,
      ];
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
      res.end(lines.join('\n') + '\n');
      record(route, Date.now() - t0, false);
      return;
    }

    if (route === '/api/catalog' && req.method === 'GET') {
      const ms = await work(route);
      return json(200, {
        items: [
          { id: 'sku-1', name: 'Widget', price: 19.99 },
          { id: 'sku-2', name: 'Gadget', price: 49.5 },
          { id: 'sku-3', name: 'Doohickey', price: 9.25 },
          { id: 'sku-4', name: 'Sprocket', price: 14.0 },
        ],
        latency_ms: ms,
      });
    }

    if (route === '/api/checkout' && req.method === 'POST') {
      const ms = await work(route);
      if (Math.random() < 0.05) {
        return json(503, {
          error: 'payment_upstream_timeout',
          request_id: reqId,
          latency_ms: ms,
        });
      }
      const order = {
        id: `ord_${reqId}`,
        status: 'confirmed',
        latency_ms: ms,
      };
      orders.unshift({ id: order.id, status: order.status });
      if (orders.length > 50) orders.pop();
      return json(200, order);
    }

    if (route === '/api/orders' && req.method === 'GET') {
      const ms = await work(route);
      return json(200, {
        orders: orders.slice(0, 20),
        latency_ms: ms,
      });
    }

    if (route === '/api/stats' && req.method === 'GET') {
      return json(200, {
        service: SERVICE,
        version: VERSION,
        requests: stats.requests,
        errors: stats.errors,
        error_rate: stats.requests ? stats.errors / stats.requests : 0,
        latency_p99_ms: p99(),
        latency_avg_ms: avg(),
        by_route: stats.byRoute,
        last_error: stats.lastError,
      });
    }

    // Shop webpage + static assets
    if (req.method === 'GET' && serveStatic(route, res)) {
      return;
    }

    return json(404, { error: 'not_found', path: route });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ACME Shop · ${SERVICE}@${VERSION}`);
  console.log(`  UI   http://127.0.0.1:${PORT}/`);
  console.log(`  API  http://127.0.0.1:${PORT}/api/catalog`);
  console.log(`  Health / Metrics / Stats also available`);
});
