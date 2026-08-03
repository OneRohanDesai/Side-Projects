import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { QueueEngine } from "@the-waitlist/core";
import type { AuthService } from "./auth/auth-service";
import {
  requireStaff,
  sessionMiddleware,
  type AuthVariables,
} from "./auth/middleware";
import { securityHeaders } from "./auth/security-headers";
import { authRoutes } from "./routes/auth";
import { orgRoutes } from "./routes/orgs";
import {
  entryRoutes,
  publicRoutes,
  queueRoutes,
} from "./routes/queues";
import type { RealtimeHub } from "./ws/hub";
import { clientIp, rateLimit } from "./auth/rate-limit";
import { lanAddresses, publicBaseUrls } from "./network";

export type AppEnv = {
  Variables: AuthVariables & {
    engine: QueueEngine;
    hub: RealtimeHub;
  };
};

export function createApp(
  engine: QueueEngine,
  hub: RealtimeHub,
  auth: AuthService,
) {
  const app = new Hono<AppEnv>();

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const origins = corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);

  app.use("*", securityHeaders);
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origins[0] ?? "http://localhost:5173";
        return origins.includes(origin) ? origin : "";
      },
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      credentials: true,
      maxAge: 600,
    }),
  );

  app.use("*", sessionMiddleware(auth));

  app.use("*", async (c, next) => {
    c.set("engine", engine);
    c.set("hub", hub);
    await next();
  });

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      mode: process.env.APP_MODE ?? "standalone",
      wsClients: hub.clientCount,
      time: new Date().toISOString(),
    }),
  );

  /** LAN URLs so phones on the same Wi‑Fi can open the app / join pages. */
  app.get("/api/network", (c) => {
    const port = Number(process.env.PORT ?? 3001);
    return c.json({
      lan: lanAddresses(),
      urls: publicBaseUrls(port),
      port,
      hint: "Open a LAN URL from a phone on the same Wi‑Fi. Use /join/<slug> for guests.",
    });
  });

  app.route("/api/auth", authRoutes(auth));

  // Org search is public (signup); management is staff-gated below
  app.get("/api/orgs/search", async (c) => {
    const ip = clientIp(c.req.raw);
    const rl = rateLimit(`orgsearch:${ip}`, 30, 60_000);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json(
        { error: { message: "Too many requests", code: "RATE_LIMIT" } },
        429,
      );
    }
    const q = c.req.query("q") ?? "";
    const organizations = await auth.orgService.searchOrgs(q);
    return c.json({ organizations });
  });

  app.use("/api/public/*", async (c, next) => {
    const ip = clientIp(c.req.raw);
    const rl = rateLimit(`public:${ip}`, 60, 60_000);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json(
        { error: { message: "Too many requests", code: "RATE_LIMIT" } },
        429,
      );
    }
    await next();
  });
  app.route("/api/public", publicRoutes(engine));

  const staff = new Hono<AppEnv>();
  staff.use("*", requireStaff());
  staff.route("/queues", queueRoutes(engine, auth));
  staff.route("/entries", entryRoutes(engine, auth));
  staff.route("/orgs", orgRoutes(auth, hub));
  app.route("/api", staff);

  app.notFound((c) =>
    c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json(
      { error: { message: "Internal server error", code: "INTERNAL" } },
      500,
    );
  });

  return app;
}
