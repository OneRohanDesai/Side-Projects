import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Actor, QueueEngine } from "@the-waitlist/core";
import { QueueError } from "@the-waitlist/core";
import type { AuthService } from "../auth/auth-service";
import type { AuthVariables } from "../auth/middleware";

async function actorOf(
  auth: AuthService,
  userId: string | undefined,
): Promise<Actor | null> {
  if (!userId) return null;
  return auth.orgService.resolveActor(userId);
}

export function queueRoutes(engine: QueueEngine, auth: AuthService) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.get("/", async (c) => {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json(
          { error: { message: "Authentication required", code: "UNAUTHORIZED" } },
          401,
        );
      }
      const actor = await actorOf(auth, user.id);
      if (!actor) {
        return c.json({ queues: [] });
      }
      const queues = await engine.listQueuesFor(actor);
      return c.json({ queues });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(80),
        avgServiceMinutes: z.number().int().min(1).max(240).optional(),
        scope: z.enum(["personal", "organization", "roles"]).optional(),
        roleIds: z.array(z.string().min(1)).max(20).optional(),
      }),
    ),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
        const actor = await actorOf(auth, user.id);
        if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
        const body = c.req.valid("json");
        const queue = await engine.createQueue(body, actor);
        return c.json({ queue }, 201);
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.get("/:id", async (c) => {
    try {
      const user = c.get("user");
      if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
      const actor = await actorOf(auth, user.id);
      if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
      const queue = await engine.getQueueWithStatsFor(actor, c.req.param("id"));
      return c.json({ queue });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(80).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        avgServiceMinutes: z.number().int().min(1).max(240).optional(),
        scope: z.enum(["personal", "organization", "roles"]).optional(),
        roleIds: z.array(z.string().min(1)).max(20).optional(),
      }),
    ),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
        const actor = await actorOf(auth, user.id);
        if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
        const queue = await engine.updateQueue(
          c.req.param("id"),
          c.req.valid("json"),
          actor,
        );
        return c.json({ queue });
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.delete("/:id", async (c) => {
    try {
      const user = c.get("user");
      if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
      const actor = await actorOf(auth, user.id);
      if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
      const queue = await engine.archiveQueue(c.req.param("id"), actor);
      return c.json({ queue });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post(
    "/:id/destroy",
    zValidator(
      "json",
      z.object({
        confirmName: z.string().min(1).max(80),
      }),
    ),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
        const actor = await actorOf(auth, user.id);
        if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
        await engine.deleteQueue(
          c.req.param("id"),
          c.req.valid("json").confirmName,
          actor,
        );
        return c.json({ ok: true });
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.get("/:id/entries", async (c) => {
    try {
      const user = c.get("user");
      if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
      const actor = await actorOf(auth, user.id);
      if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
      const entries = await engine.listActiveEntries(c.req.param("id"), actor);
      return c.json({ entries });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.get("/:id/history", async (c) => {
    try {
      const user = c.get("user");
      if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
      const actor = await actorOf(auth, user.id);
      if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
      const limit = Number(c.req.query("limit") ?? 50);
      const entries = await engine.listRecentHistory(
        c.req.param("id"),
        Math.min(Math.max(limit, 1), 200),
        actor,
      );
      return c.json({ entries });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post(
    "/:id/history/delete",
    zValidator(
      "json",
      z
        .object({
          ids: z.array(z.string().min(1).max(64)).max(500).optional(),
          all: z.boolean().optional(),
        })
        .refine((b) => b.all === true || (b.ids && b.ids.length > 0), {
          message: "Provide ids or all: true",
        }),
    ),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
        const actor = await actorOf(auth, user.id);
        if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
        const body = c.req.valid("json");
        const result = await engine.deleteHistory(
          c.req.param("id"),
          body,
          actor,
        );
        return c.json(result);
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.post(
    "/:id/entries",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        partySize: z.number().int().min(1).max(99).optional(),
        phone: z.string().max(40).nullable().optional(),
        email: z
          .string()
          .email()
          .max(200)
          .nullable()
          .optional()
          .or(z.literal("")),
        note: z.string().max(500).nullable().optional(),
      }),
    ),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
        const actor = await actorOf(auth, user.id);
        if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
        const body = c.req.valid("json");
        const entry = await engine.addEntry(
          c.req.param("id"),
          { ...body, email: body.email || null },
          actor,
        );
        return c.json({ entry }, 201);
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.post("/:id/call-next", async (c) => {
    try {
      const user = c.get("user");
      if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
      const actor = await actorOf(auth, user.id);
      if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
      const entry = await engine.callNext(c.req.param("id"), actor);
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  return app;
}

export function entryRoutes(engine: QueueEngine, auth: AuthService) {
  const app = new Hono<{ Variables: AuthVariables }>();

  async function gate(c: {
    get: (k: "user") => AuthVariables["user"];
  }) {
    const user = c.get("user");
    if (!user) throw new QueueError("Authentication required", "FORBIDDEN");
    const actor = await actorOf(auth, user.id);
    if (!actor) throw new QueueError("Authentication required", "FORBIDDEN");
    return actor;
  }

  app.get("/:id", async (c) => {
    try {
      await gate(c);
      const entry = await engine.getEntry(c.req.param("id"));
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.patch(
    "/:id",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100).optional(),
        partySize: z.number().int().min(1).max(99).optional(),
        phone: z.string().max(40).nullable().optional(),
        email: z.string().max(200).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
        status: z
          .enum(["waiting", "called", "served", "no_show", "cancelled"])
          .optional(),
      }),
    ),
    async (c) => {
      try {
        await gate(c);
        const entry = await engine.updateEntry(
          c.req.param("id"),
          c.req.valid("json"),
        );
        return c.json({ entry });
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.post("/:id/call", async (c) => {
    try {
      await gate(c);
      const entry = await engine.callEntry(c.req.param("id"));
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post("/:id/serve", async (c) => {
    try {
      await gate(c);
      const entry = await engine.markServed(c.req.param("id"));
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post("/:id/no-show", async (c) => {
    try {
      await gate(c);
      const entry = await engine.markNoShow(c.req.param("id"));
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post("/:id/cancel", async (c) => {
    try {
      await gate(c);
      const entry = await engine.cancelEntry(c.req.param("id"));
      return c.json({ entry });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.post(
    "/:id/reorder",
    zValidator(
      "json",
      z.object({
        position: z.number().int().min(1),
      }),
    ),
    async (c) => {
      try {
        await gate(c);
        const { position } = c.req.valid("json");
        const entries = await engine.reorderEntry(c.req.param("id"), position);
        return c.json({ entries });
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  return app;
}

export function publicRoutes(engine: QueueEngine) {
  const app = new Hono();

  app.post(
    "/join/:slug",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        partySize: z.number().int().min(1).max(99).optional(),
        phone: z.string().max(40).nullable().optional(),
        email: z
          .string()
          .max(200)
          .nullable()
          .optional()
          .or(z.literal("")),
        note: z.string().max(500).nullable().optional(),
      }),
    ),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const entry = await engine.addEntry(
          c.req.param("slug"),
          { ...body, email: body.email || null },
          null,
        );
        return c.json({ entry }, 201);
      } catch (err) {
        return handleError(c, err);
      }
    },
  );

  app.get("/queue/:slug", async (c) => {
    try {
      const queue = await engine.getQueueWithStats(c.req.param("slug"));
      if (queue.status === "archived") {
        throw new QueueError("Queue not found", "NOT_FOUND");
      }
      return c.json({
        queue: {
          id: queue.id,
          name: queue.name,
          slug: queue.slug,
          status: queue.status,
          waitingCount: queue.waitingCount,
          avgServiceMinutes: queue.avgServiceMinutes,
        },
      });
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.get("/status/:token", async (c) => {
    try {
      const { entry, queue } = await engine.getEntryByToken(c.req.param("token"));
      return c.json({
        entry: {
          id: entry.id,
          name: entry.name,
          partySize: entry.partySize,
          status: entry.status,
          position: entry.position,
          estimatedWait: entry.estimatedWait,
          publicToken: entry.publicToken,
        },
        queue: {
          id: queue.id,
          name: queue.name,
          slug: queue.slug,
        },
      });
    } catch (err) {
      return handleError(c, err);
    }
  });

  return app;
}

function handleError(
  c: { json: (data: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof QueueError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "VALIDATION"
          ? 400
          : err.code === "INVALID_STATE"
            ? 409
            : err.code === "FORBIDDEN"
              ? 403
              : 400;
    return c.json({ error: { message: err.message, code: err.code } }, status);
  }
  console.error(err);
  return c.json(
    { error: { message: "Internal server error", code: "INTERNAL" } },
    500,
  );
}
