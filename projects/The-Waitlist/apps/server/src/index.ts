import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  createDb,
  ensureSchema,
  QueueEngine,
} from "@the-waitlist/core";
import { createApp } from "./app";
import { AuthService } from "./auth/auth-service";
import { getSessionToken } from "./auth/cookies";
import { publicBaseUrls } from "./network";
import { tryStatic } from "./static";
import { RealtimeHub, type ClientData } from "./ws/hub";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DB_PATH = resolve(
  process.env.DATABASE_URL ?? resolve(REPO_ROOT, "data/waitlist.db"),
);
const WEB_ROOT = resolve(
  process.env.WEB_ROOT ?? resolve(REPO_ROOT, "apps/web/build"),
);

mkdirSync(resolve(DB_PATH, ".."), { recursive: true });
ensureSchema(DB_PATH);

const db = createDb(DB_PATH);
const hub = new RealtimeHub();
const engine = new QueueEngine(db, (event) => hub.broadcast(event));
const auth = new AuthService(db);
const app = createApp(engine, hub, auth);

auth.orgService
  .migrateLegacyUsers()
  .then((n) => {
    if (n > 0) console.log(`  migrated ${n} legacy user(s) → individual orgs`);
  })
  .catch((e) => console.error("legacy migrate failed", e));

setInterval(() => {
  auth.purgeExpiredSessions().catch(() => {});
}, 15 * 60_000).unref?.();

const hasWeb = existsSync(WEB_ROOT);

console.log(`The Waitlist`);
console.log(`  database: ${DB_PATH}`);
console.log(`  web:      ${hasWeb ? WEB_ROOT : "(dev UI on :5173 — run bun run build first for single-port)"}`);
console.log(`  listening http://${HOST}:${PORT}`);
for (const u of publicBaseUrls(PORT)) {
  console.log(`  lan       ${u}`);
}
console.log(`  websocket ws://${HOST}:${PORT}/ws`);

const server = Bun.serve<ClientData>({
  port: PORT,
  hostname: HOST,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const needsBootstrap = await auth.needsBootstrap();
      let userId: string | null = null;
      let organizationId: string | null = null;

      if (!needsBootstrap) {
        const token = getSessionToken(req);
        const session = await auth.resolveSession(token);
        if (!session) {
          return new Response("Unauthorized", { status: 401 });
        }
        userId = session.user.id;
        organizationId = session.user.organizationId;
      }

      const upgraded = server.upgrade(req, {
        data: {
          queues: new Set<string>(),
          organizationId,
          userId,
          role: "staff" as const,
        },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // API always via Hono
    if (url.pathname.startsWith("/api")) {
      return app.fetch(req, server);
    }

    // Production: serve static SPA
    if (hasWeb && req.method === "GET") {
      const staticRes = tryStatic(WEB_ROOT, url.pathname);
      if (staticRes) return staticRes;
    }

    return app.fetch(req, server);
  },
  websocket: {
    open(ws) {
      hub.add(ws);
      ws.send(
        JSON.stringify({
          type: "connected",
          payload: {
            clients: hub.clientCount,
            userId: ws.data.userId,
            organizationId: ws.data.organizationId,
          },
          timestamp: new Date().toISOString(),
        }),
      );
    },
    message(ws, message) {
      try {
        const data =
          typeof message === "string"
            ? JSON.parse(message)
            : JSON.parse(new TextDecoder().decode(message));

        if (data.type === "subscribe" && typeof data.queueId === "string") {
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(data.queueId)) return;
          hub.subscribe(ws, data.queueId);
          ws.send(
            JSON.stringify({
              type: "subscribed",
              queueId: data.queueId,
              timestamp: new Date().toISOString(),
            }),
          );
        }
        if (data.type === "unsubscribe" && typeof data.queueId === "string") {
          hub.unsubscribe(ws, data.queueId);
        }
        if (data.type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      } catch {
        // ignore
      }
    },
    close(ws) {
      hub.remove(ws);
    },
  },
});

console.log(`  ready on port ${server.port}`);
