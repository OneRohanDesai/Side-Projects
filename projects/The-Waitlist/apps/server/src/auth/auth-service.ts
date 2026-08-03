import { and, count, eq, gt, lt } from "drizzle-orm";
import type { Database } from "@the-waitlist/core";
import { createId, OrgService } from "@the-waitlist/core";
import { organizations, roles, sessions, users } from "@the-waitlist/core/db/schema";
import type { OrgType, PublicUser } from "@the-waitlist/core";
import {
  hashClientMeta,
  hashPassword,
  randomToken,
  sha256Hex,
  verifyPassword,
} from "./crypto";
import { validatePassword, validateUsername } from "./password-policy";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_FAILED = 5;
const LOCK_MS = 1000 * 60 * 15;

export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | "VALIDATION"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "LOCKED"
      | "CONFLICT"
      | "RATE_LIMIT",
    public status = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type SessionUser = PublicUser;

export type AuthSession = {
  sessionId: string;
  token: string;
  csrfToken: string;
  expiresAt: Date;
  user: SessionUser;
  /** Only returned once when registering a new team org */
  joinSecretCode?: string;
};

export type SignupInput =
  | {
      mode: "individual";
      username: string;
      password: string;
      email?: string | null;
    }
  | {
      mode: "join";
      username: string;
      password: string;
      email?: string | null;
      organizationId: string;
      secretCode: string;
    }
  | {
      mode: "register_org";
      username: string;
      password: string;
      email: string;
      organizationName: string;
    };

export class AuthService {
  private orgs: OrgService;

  constructor(private db: Database) {
    this.orgs = new OrgService(db);
  }

  get orgService() {
    return this.orgs;
  }

  async userCount(): Promise<number> {
    const rows = await this.db.select({ c: count() }).from(users);
    return Number(rows[0]?.c ?? 0);
  }

  async needsBootstrap(): Promise<boolean> {
    return (await this.userCount()) === 0;
  }

  async toPublicUser(userId: string): Promise<SessionUser | null> {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        roleId: users.roleId,
        roleName: roles.name,
        canManageOrg: roles.canManageOrg,
        organizationId: users.organizationId,
        organizationName: organizations.name,
        organizationType: organizations.type,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.id, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      username: r.username,
      role: (r.roleName ?? r.role ?? "staff") as string,
      roleId: r.roleId,
      roleName: r.roleName ?? r.role ?? "staff",
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      organizationType: (r.organizationType as OrgType) ?? null,
      canManageOrg: !!r.canManageOrg,
    };
  }

  async signup(
    input: SignupInput,
    meta: { ip: string; userAgent: string },
  ): Promise<AuthSession> {
    const userErr = validateUsername(input.username);
    if (userErr) throw new AuthError(userErr, "VALIDATION");
    const passErr = validatePassword(input.password);
    if (passErr) throw new AuthError(passErr, "VALIDATION");

    const username = input.username.trim().toLowerCase();
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (existing[0]) {
      throw new AuthError("Username already taken", "CONFLICT", 409);
    }

    let email: string | null = null;
    if ("email" in input && input.email?.trim()) {
      email = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
        throw new AuthError("Invalid email", "VALIDATION");
      }
    }

    const userId = createId("u");
    const passwordHash = await hashPassword(input.password);
    const ts = new Date();
    let joinSecretCode: string | undefined;
    let organizationId: string;
    let roleId: string;
    let roleName: string;

    if (input.mode === "individual") {
      const shell = await this.orgs.createIndividualOrg(username);
      organizationId = shell.org.id;
      roleId = shell.managerRole.id;
      roleName = "manager";
    } else if (input.mode === "register_org") {
      if (!email) {
        throw new AuthError(
          "Email is required to register an organization",
          "VALIDATION",
        );
      }
      const shell = await this.orgs.createTeamOrg({
        name: input.organizationName,
        contactEmail: email,
      });
      organizationId = shell.org.id;
      roleId = shell.managerRole.id;
      roleName = "manager";
      joinSecretCode = shell.secretCode;
    } else {
      // join existing team
      const ok = await this.orgs.verifyJoinCode(
        input.organizationId,
        input.secretCode,
      );
      if (!ok) {
        throw new AuthError(
          "Invalid or expired organization join code",
          "FORBIDDEN",
          403,
        );
      }
      const org = await this.orgs.getOrg(input.organizationId);
      if (!org || org.type !== "team") {
        throw new AuthError("Organization not found", "VALIDATION");
      }
      const staffRoles = await this.db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, input.organizationId),
            eq(roles.name, "staff"),
          ),
        )
        .limit(1);
      if (!staffRoles[0]) {
        throw new AuthError("Organization misconfigured", "VALIDATION", 500);
      }
      organizationId = input.organizationId;
      roleId = staffRoles[0].id;
      roleName = "staff";
    }

    await this.db.insert(users).values({
      id: userId,
      username,
      email,
      passwordHash,
      organizationId,
      roleId,
      role: roleName,
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: ts,
      updatedAt: ts,
    });

    const session = await this.createSession(userId, meta);
    if (joinSecretCode) session.joinSecretCode = joinSecretCode;
    return session;
  }

  async login(
    input: { username: string; password: string },
    meta: { ip: string; userAgent: string },
  ): Promise<AuthSession> {
    const username = input.username.trim().toLowerCase();
    if (!username || !input.password) {
      throw new AuthError("Invalid username or password", "UNAUTHORIZED", 401);
    }

    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    const user = rows[0];

    const dummyHash =
      "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const hash = user?.passwordHash ?? dummyHash;

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await verifyPassword(input.password, hash);
      throw new AuthError(
        "Account temporarily locked. Try again later.",
        "LOCKED",
        423,
      );
    }

    const ok = await verifyPassword(input.password, hash);
    if (!user || !ok) {
      if (user) await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new AuthError("Invalid username or password", "UNAUTHORIZED", 401);
    }

    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Multi-device allowed by default (live sync). Set AUTH_SINGLE_SESSION=1 to force one.
    if (process.env.AUTH_SINGLE_SESSION === "1") {
      await this.db.delete(sessions).where(eq(sessions.userId, user.id));
    }

    return this.createSession(user.id, meta);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token) return;
    const tokenHash = await sha256Hex(token);
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async resolveSession(
    token: string | null | undefined,
    meta?: { ip: string; userAgent: string },
  ): Promise<{ user: SessionUser; csrfToken: string; sessionId: string } | null> {
    if (!token || token.length < 20 || token.length > 200) return null;
    const tokenHash = await sha256Hex(token);
    const rows = await this.db
      .select({
        sessionId: sessions.id,
        csrfToken: sessions.csrfToken,
        expiresAt: sessions.expiresAt,
        lastSeenAt: sessions.lastSeenAt,
        userId: users.id,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const now = new Date();
    const newExpiry = new Date(now.getTime() + SESSION_TTL_MS);
    if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
      await this.db
        .update(sessions)
        .set({
          lastSeenAt: now,
          expiresAt: newExpiry,
          ...(meta
            ? {
                ipHash: await hashClientMeta(meta.ip),
                userAgentHash: await hashClientMeta(
                  meta.userAgent.slice(0, 256),
                ),
              }
            : {}),
        })
        .where(eq(sessions.id, row.sessionId));
    }

    const user = await this.toPublicUser(row.userId);
    if (!user) return null;

    return {
      sessionId: row.sessionId,
      csrfToken: row.csrfToken,
      user,
    };
  }

  async purgeExpiredSessions(): Promise<void> {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  private async createSession(
    userId: string,
    meta: { ip: string; userAgent: string },
  ): Promise<AuthSession> {
    const token = randomToken(32);
    const csrfToken = randomToken(24);
    const tokenHash = await sha256Hex(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const sessionId = createId("s");

    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash,
      csrfToken,
      expiresAt,
      lastSeenAt: now,
      ipHash: await hashClientMeta(meta.ip),
      userAgentHash: await hashClientMeta(meta.userAgent.slice(0, 256)),
      createdAt: now,
    });

    const user = (await this.toPublicUser(userId))!;
    return {
      sessionId,
      token,
      csrfToken,
      expiresAt,
      user,
    };
  }

  private async recordFailedLogin(userId: string, current: number) {
    const next = current + 1;
    const patch: {
      failedLoginCount: number;
      lockedUntil?: Date | null;
      updatedAt: Date;
    } = {
      failedLoginCount: next,
      updatedAt: new Date(),
    };
    if (next >= MAX_FAILED) {
      patch.lockedUntil = new Date(Date.now() + LOCK_MS);
      patch.failedLoginCount = 0;
    }
    await this.db.update(users).set(patch).where(eq(users.id, userId));
  }
}
