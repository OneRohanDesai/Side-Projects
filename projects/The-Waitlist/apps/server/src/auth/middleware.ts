import type { MiddlewareHandler } from "hono";
import type { AuthService, SessionUser } from "./auth-service";
import { AuthError } from "./auth-service";
import { getSessionToken } from "./cookies";
import { clientIp } from "./rate-limit";

export type AuthVariables = {
  user: SessionUser | null;
  csrfToken: string | null;
  sessionId: string | null;
  auth: AuthService;
  requireAuth: boolean;
};

export type { SessionUser };

/**
 * Attach session user (if any) to context.
 * Does not reject unauthenticated requests — use requireStaff after.
 */
export function sessionMiddleware(
  auth: AuthService,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    c.set("auth", auth);
    const token = getSessionToken(c.req.raw);
    const meta = {
      ip: clientIp(c.req.raw),
      userAgent: c.req.header("user-agent") ?? "",
    };
    const session = await auth.resolveSession(token, meta);
    c.set("user", session?.user ?? null);
    c.set("csrfToken", session?.csrfToken ?? null);
    c.set("sessionId", session?.sessionId ?? null);
    await next();
  };
}

/**
 * Staff routes: if any user exists, require a valid session + CSRF on mutations.
 * Bootstrap mode (zero users) allows unauthenticated access so first owner can sign up.
 */
export function requireStaff(): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const auth = c.get("auth");
    const needsBootstrap = await auth.needsBootstrap();
    c.set("requireAuth", !needsBootstrap);

    if (needsBootstrap) {
      // Only allow bootstrap + public-ish reads until first account exists.
      // Still block if AUTH_FORCE=1
      if (process.env.AUTH_FORCE === "1") {
        return c.json(
          {
            error: {
              message: "Create an account first (sign up in the header).",
              code: "UNAUTHORIZED",
            },
          },
          401,
        );
      }
      return next();
    }

    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          error: {
            message: "Authentication required",
            code: "UNAUTHORIZED",
          },
        },
        401,
      );
    }

    // CSRF for unsafe methods
    const method = c.req.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const expected = c.get("csrfToken");
      const provided =
        c.req.header("x-csrf-token") ?? c.req.header("X-CSRF-Token");
      if (!expected || !provided || provided !== expected) {
        return c.json(
          {
            error: {
              message: "Invalid or missing CSRF token",
              code: "FORBIDDEN",
            },
          },
          403,
        );
      }
    }

    await next();
  };
}

export function handleAuthError(err: unknown) {
  if (err instanceof AuthError) {
    return {
      body: { error: { message: err.message, code: err.code } },
      status: err.status as 400 | 401 | 403 | 409 | 423 | 429,
    };
  }
  return null;
}
