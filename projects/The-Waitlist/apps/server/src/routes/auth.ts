import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthService, SignupInput } from "../auth/auth-service";
import { AuthError } from "../auth/auth-service";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "../auth/cookies";
import type { AuthVariables } from "../auth/middleware";
import { handleAuthError } from "../auth/middleware";
import { clientIp, rateLimit } from "../auth/rate-limit";

const password = z.string().min(1).max(128);
const username = z.string().min(1).max(32);

export function authRoutes(auth: AuthService) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.get("/status", async (c) => {
    const needsBootstrap = await auth.needsBootstrap();
    const user = c.get("user");
    return c.json({
      needsBootstrap,
      authenticated: !!user,
      user,
      csrfToken: c.get("csrfToken"),
      appMode: process.env.APP_MODE ?? "local",
    });
  });

  app.get("/me", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: { message: "Not authenticated", code: "UNAUTHORIZED" } },
        401,
      );
    }
    return c.json({ user, csrfToken: c.get("csrfToken") });
  });

  app.post(
    "/signup",
    zValidator(
      "json",
      z.discriminatedUnion("mode", [
        z.object({
          mode: z.literal("individual"),
          username,
          password,
          email: z.string().email().max(200).optional().or(z.literal("")),
        }),
        z.object({
          mode: z.literal("join"),
          username,
          password,
          email: z.string().email().max(200).optional().or(z.literal("")),
          organizationId: z.string().min(1).max(64),
          secretCode: z.string().min(4).max(32),
        }),
        z.object({
          mode: z.literal("register_org"),
          username,
          password,
          email: z.string().email().max(200),
          organizationName: z.string().min(2).max(80),
        }),
      ]),
    ),
    async (c) => {
      try {
        const ip = clientIp(c.req.raw);
        const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
        if (!rl.ok) {
          c.header("Retry-After", String(rl.retryAfterSec));
          throw new AuthError("Too many signups. Try later.", "RATE_LIMIT", 429);
        }

        const body = c.req.valid("json") as SignupInput;
        const session = await auth.signup(body, {
          ip,
          userAgent: c.req.header("user-agent") ?? "",
        });

        c.header(
          "Set-Cookie",
          setSessionCookie(session.token, session.expiresAt),
        );
        return c.json(
          {
            user: session.user,
            csrfToken: session.csrfToken,
            expiresAt: session.expiresAt.toISOString(),
            joinSecretCode: session.joinSecretCode ?? null,
          },
          201,
        );
      } catch (err) {
        return respondAuthError(c, err);
      }
    },
  );

  app.post(
    "/login",
    zValidator(
      "json",
      z.object({ username, password }),
    ),
    async (c) => {
      try {
        const ip = clientIp(c.req.raw);
        const body = c.req.valid("json");
        const key = `login:${ip}:${body.username.trim().toLowerCase()}`;
        const rl = rateLimit(key, 10, 15 * 60 * 1000);
        if (!rl.ok) {
          c.header("Retry-After", String(rl.retryAfterSec));
          throw new AuthError(
            "Too many login attempts. Try later.",
            "RATE_LIMIT",
            429,
          );
        }

        const session = await auth.login(
          { username: body.username, password: body.password },
          {
            ip,
            userAgent: c.req.header("user-agent") ?? "",
          },
        );

        c.header(
          "Set-Cookie",
          setSessionCookie(session.token, session.expiresAt),
        );
        return c.json({
          user: session.user,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt.toISOString(),
        });
      } catch (err) {
        return respondAuthError(c, err);
      }
    },
  );

  app.post("/logout", async (c) => {
    const user = c.get("user");
    if (user) {
      const expected = c.get("csrfToken");
      const provided = c.req.header("x-csrf-token");
      if (!expected || provided !== expected) {
        return c.json(
          { error: { message: "Invalid CSRF token", code: "FORBIDDEN" } },
          403,
        );
      }
    }
    const token = getSessionToken(c.req.raw);
    await auth.logout(token);
    c.header("Set-Cookie", clearSessionCookie());
    return c.json({ ok: true });
  });

  app.post("/logout-all", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: { message: "Not authenticated", code: "UNAUTHORIZED" } },
        401,
      );
    }
    const expected = c.get("csrfToken");
    const provided = c.req.header("x-csrf-token");
    if (!expected || provided !== expected) {
      return c.json(
        { error: { message: "Invalid CSRF token", code: "FORBIDDEN" } },
        403,
      );
    }
    await auth.logoutAll(user.id);
    c.header("Set-Cookie", clearSessionCookie());
    return c.json({ ok: true });
  });

  return app;
}

function respondAuthError(
  c: { json: (data: unknown, status?: number) => Response },
  err: unknown,
) {
  const handled = handleAuthError(err);
  if (handled) return c.json(handled.body, handled.status);
  // Map QueueError-like
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as { message: string; code: string };
    const status =
      e.code === "FORBIDDEN"
        ? 403
        : e.code === "VALIDATION"
          ? 400
          : e.code === "CONFLICT"
            ? 409
            : 400;
    return c.json({ error: { message: e.message, code: e.code } }, status);
  }
  console.error(err);
  return c.json(
    { error: { message: "Internal server error", code: "INTERNAL" } },
    500,
  );
}
