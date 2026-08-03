import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthService } from "../auth/auth-service";
import type { AuthVariables } from "../auth/middleware";
import type { RealtimeHub } from "../ws/hub";
import { QueueError } from "@the-waitlist/core";

export function orgRoutes(auth: AuthService, hub: RealtimeHub) {
  const app = new Hono<{ Variables: AuthVariables }>();
  const orgs = auth.orgService;

  /** Public searchable team orgs (for signup join) */
  app.get("/search", async (c) => {
    const q = c.req.query("q") ?? "";
    const results = await orgs.searchOrgs(q);
    return c.json({ organizations: results });
  });

  /** Current org (members only) */
  app.get("/mine", async (c) => {
    const user = c.get("user");
    if (!user?.organizationId) {
      return c.json({ organization: null, roles: [], members: [] });
    }
    const organization = await orgs.getOrg(user.organizationId);
    const roles = await orgs.listRoles(user.organizationId);
    const members = user.canManageOrg
      ? await orgs.listMembers(user.organizationId)
      : [];
    return c.json({
      organization,
      roles,
      members,
      secretCodeExpiresAt: organization?.secretCodeExpiresAt ?? null,
    });
  });

  app.post("/mine/rotate-code", async (c) => {
    const user = c.get("user");
    if (!user?.canManageOrg || !user.organizationId) {
      return c.json(
        { error: { message: "Manager only", code: "FORBIDDEN" } },
        403,
      );
    }
    try {
      const code = await orgs.rotateSecretCode(user.organizationId);
      hub.broadcast({
        type: "org.updated",
        queueId: "",
        organizationId: user.organizationId,
        payload: { secretRotated: true },
        timestamp: new Date().toISOString(),
      });
      return c.json({
        secretCode: code,
        // In managed mode a mailer would send this to contactEmail
        deliveredTo: (await orgs.getOrg(user.organizationId))?.contactEmail,
        note:
          "Share this code with staff joining today. It expires automatically; rotate anytime.",
      });
    } catch (err) {
      return handle(c, err);
    }
  });

  app.get("/mine/members", async (c) => {
    const user = c.get("user");
    if (!user?.canManageOrg || !user.organizationId) {
      return c.json(
        { error: { message: "Manager only", code: "FORBIDDEN" } },
        403,
      );
    }
    const members = await orgs.listMembers(user.organizationId);
    return c.json({ members });
  });

  app.get("/mine/roles", async (c) => {
    const user = c.get("user");
    if (!user?.organizationId) {
      return c.json({ roles: [] });
    }
    const roles = await orgs.listRoles(user.organizationId);
    return c.json({ roles });
  });

  app.post(
    "/mine/roles",
    zValidator(
      "json",
      z.object({
        name: z.string().min(2).max(32),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user?.canManageOrg || !user.organizationId) {
        return c.json(
          { error: { message: "Manager only", code: "FORBIDDEN" } },
          403,
        );
      }
      try {
        const role = await orgs.createRole(user.organizationId, {
          name: c.req.valid("json").name,
          isSystem: false,
          canManageOrg: false,
          canManageQueues: true,
        });
        hub.broadcast({
          type: "members.updated",
          queueId: "",
          organizationId: user.organizationId,
          payload: { roleCreated: role.name },
          timestamp: new Date().toISOString(),
        });
        return c.json({ role }, 201);
      } catch (err) {
        return handle(c, err);
      }
    },
  );

  app.delete("/mine/roles/:roleId", async (c) => {
    const user = c.get("user");
    if (!user?.canManageOrg || !user.organizationId) {
      return c.json(
        { error: { message: "Manager only", code: "FORBIDDEN" } },
        403,
      );
    }
    try {
      const actor = await orgs.resolveActor(user.id);
      if (!actor) throw new QueueError("Forbidden", "FORBIDDEN");
      await orgs.deleteRole(c.req.param("roleId"), actor);
      hub.broadcast({
        type: "members.updated",
        queueId: "",
        organizationId: user.organizationId,
        payload: { roleDeleted: true },
        timestamp: new Date().toISOString(),
      });
      return c.json({ ok: true });
    } catch (err) {
      return handle(c, err);
    }
  });

  app.post(
    "/mine/members/:userId/role",
    zValidator(
      "json",
      z.object({
        roleId: z.string().min(1),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user?.canManageOrg || !user.organizationId) {
        return c.json(
          { error: { message: "Manager only", code: "FORBIDDEN" } },
          403,
        );
      }
      try {
        const actor = await orgs.resolveActor(user.id);
        if (!actor) throw new QueueError("Forbidden", "FORBIDDEN");
        await orgs.assignRole(
          c.req.param("userId"),
          c.req.valid("json").roleId,
          actor,
        );
        hub.broadcast({
          type: "members.updated",
          queueId: "",
          organizationId: user.organizationId,
          payload: { memberRoleChanged: c.req.param("userId") },
          timestamp: new Date().toISOString(),
        });
        return c.json({ ok: true });
      } catch (err) {
        return handle(c, err);
      }
    },
  );

  return app;
}

function handle(
  c: { json: (data: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof QueueError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "VALIDATION"
            ? 400
            : 400;
    return c.json({ error: { message: err.message, code: err.code } }, status);
  }
  console.error(err);
  return c.json(
    { error: { message: "Internal server error", code: "INTERNAL" } },
    500,
  );
}
