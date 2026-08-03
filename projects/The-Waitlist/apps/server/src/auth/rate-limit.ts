/**
 * In-memory sliding-window rate limiter.
 * Fine for single-node local/managed; swap for Redis on multi-instance.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: Math.max(0, limit - b.count) };
}

export function clientIp(req: Request): string {
  // Prefer reverse-proxy headers only when trusted (local defaults to direct).
  const trustProxy = process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const xf = req.headers.get("x-forwarded-for");
    if (xf) return xf.split(",")[0]!.trim().slice(0, 64);
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return "direct";
}
