import type { MiddlewareHandler } from "hono";

/** Hardened default headers for the API. */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "no-referrer");
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  c.res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  c.res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // API responses should not be cached by shared caches
  if (c.req.path.startsWith("/api/")) {
    c.res.headers.set("Cache-Control", "no-store");
  }
};
