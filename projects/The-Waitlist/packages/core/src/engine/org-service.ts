import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { organizations, roles, users } from "../db/schema";
import type {
  Actor,
  Organization,
  OrgPublic,
  OrgType,
  Role,
} from "../types";
import { QueueError } from "../types";
import { createId, createSlug } from "./ids";

function now() {
  return new Date();
}

function toOrg(row: typeof organizations.$inferSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as OrgType,
    contactEmail: row.contactEmail,
    secretCodeExpiresAt: row.secretCodeExpiresAt,
    secretCodeVersion: row.secretCodeVersion,
    orgFeaturesEnabled: !!row.orgFeaturesEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRole(row: typeof roles.$inferSelect): Role {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    isSystem: !!row.isSystem,
    canManageOrg: !!row.canManageOrg,
    canManageQueues: !!row.canManageQueues,
    createdAt: row.createdAt,
  };
}

/** Generate a human-friendly daily join code (no ambiguous chars). */
export function generateSecretCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
    if (i === 3) out += "-";
  }
  return out;
}

export async function hashSecretCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  return Bun.password.hash(normalized, {
    algorithm: "argon2id",
    memoryCost: 19456,
    timeCost: 2,
  });
}

export async function verifySecretCode(
  code: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) return false;
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  try {
    return await Bun.password.verify(normalized, hash);
  } catch {
    return false;
  }
}

export function secretCodeExpiry(from = new Date()): Date {
  // Daily rotation: end of local day + small buffer, min 24h from now
  const end = new Date(from);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() - from.getTime() < 60 * 60 * 1000) {
    end.setDate(end.getDate() + 1);
  }
  // Always at least ~24h validity for "daily" codes issued late
  const min = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return end > min ? end : min;
}

export class OrgService {
  constructor(private db: Database) {}

  async getOrg(id: string): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows[0] ? toOrg(rows[0]) : null;
  }

  async searchOrgs(query: string, limit = 20): Promise<OrgPublic[]> {
    const q = query.trim().toLowerCase();
    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        type: organizations.type,
      })
      .from(organizations)
      .where(
        and(
          eq(organizations.type, "team"),
          q
            ? sql`(lower(${organizations.name}) LIKE ${"%" + q + "%"} OR lower(${organizations.slug}) LIKE ${"%" + q + "%"})`
            : sql`1=1`,
        ),
      )
      .orderBy(organizations.name)
      .limit(Math.min(Math.max(limit, 1), 50));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type as OrgType,
    }));
  }

  async createIndividualOrg(username: string): Promise<{
    org: Organization;
    managerRole: Role;
    staffRole: Role;
  }> {
    const name = username;
    return this.createOrgShell({
      name: `${name}'s workspace`,
      type: "individual",
      contactEmail: null,
    });
  }

  async createTeamOrg(input: {
    name: string;
    contactEmail: string;
  }): Promise<{
    org: Organization;
    managerRole: Role;
    staffRole: Role;
    secretCode: string;
  }> {
    const email = input.contactEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new QueueError("Valid contact email is required", "VALIDATION");
    }
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new QueueError("Organization name must be 2–80 characters", "VALIDATION");
    }

    const shell = await this.createOrgShell({
      name,
      type: "team",
      contactEmail: email,
    });
    const secretCode = await this.rotateSecretCode(shell.org.id);
    return { ...shell, secretCode };
  }

  private async createOrgShell(input: {
    name: string;
    type: OrgType;
    contactEmail: string | null;
  }) {
    const id = createId("org");
    const slug = createSlug(input.name);
    const ts = now();
    await this.db.insert(organizations).values({
      id,
      name: input.name,
      slug,
      type: input.type,
      contactEmail: input.contactEmail,
      secretCodeHash: null,
      secretCodeExpiresAt: null,
      secretCodeVersion: 0,
      orgFeaturesEnabled: true,
      createdAt: ts,
      updatedAt: ts,
    });

    const managerRole = await this.createRole(id, {
      name: "manager",
      isSystem: true,
      canManageOrg: true,
      canManageQueues: true,
    });
    const staffRole = await this.createRole(id, {
      name: "staff",
      isSystem: true,
      canManageOrg: false,
      canManageQueues: true,
    });

    const org = (await this.getOrg(id))!;
    return { org, managerRole, staffRole };
  }

  async createRole(
    organizationId: string,
    input: {
      name: string;
      isSystem?: boolean;
      canManageOrg?: boolean;
      canManageQueues?: boolean;
    },
  ): Promise<Role> {
    const name = input.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z][a-z0-9_-]{1,31}$/.test(name)) {
      throw new QueueError(
        "Role: 2–32 chars, start with letter, a-z 0-9 _ -",
        "VALIDATION",
      );
    }
    const id = createId("role");
    await this.db.insert(roles).values({
      id,
      organizationId,
      name,
      isSystem: input.isSystem ?? false,
      canManageOrg: input.canManageOrg ?? false,
      canManageQueues: input.canManageQueues ?? true,
      createdAt: now(),
    });
    const row = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);
    return toRole(row[0]!);
  }

  async listRoles(organizationId: string): Promise<Role[]> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, organizationId))
      .orderBy(roles.name);
    return rows.map(toRole);
  }

  async deleteRole(roleId: string, actor: Actor): Promise<void> {
    if (!actor.canManageOrg) throw new QueueError("Forbidden", "FORBIDDEN");
    const row = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    if (!row[0]) throw new QueueError("Role not found", "NOT_FOUND");
    if (row[0].organizationId !== actor.organizationId) {
      throw new QueueError("Forbidden", "FORBIDDEN");
    }
    if (row[0].isSystem) {
      throw new QueueError("System roles cannot be deleted", "INVALID_STATE");
    }
    // Reassign users on this role to staff
    const staff = await this.db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, actor.organizationId!),
          eq(roles.name, "staff"),
        ),
      )
      .limit(1);
    if (staff[0]) {
      await this.db
        .update(users)
        .set({ roleId: staff[0].id, role: "staff", updatedAt: now() })
        .where(eq(users.roleId, roleId));
    }
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  async rotateSecretCode(organizationId: string): Promise<string> {
    const org = await this.getOrg(organizationId);
    if (!org) throw new QueueError("Organization not found", "NOT_FOUND");
    if (org.type !== "team") {
      throw new QueueError("Only team organizations use join codes", "INVALID_STATE");
    }
    const code = generateSecretCode();
    const hash = await hashSecretCode(code);
    const expires = secretCodeExpiry();
    await this.db
      .update(organizations)
      .set({
        secretCodeHash: hash,
        secretCodeExpiresAt: expires,
        secretCodeVersion: org.secretCodeVersion + 1,
        updatedAt: now(),
      })
      .where(eq(organizations.id, organizationId));
    return code;
  }

  async verifyJoinCode(
    organizationId: string,
    code: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const org = rows[0];
    if (!org || org.type !== "team") return false;
    if (org.secretCodeExpiresAt && org.secretCodeExpiresAt.getTime() < Date.now()) {
      return false;
    }
    return verifySecretCode(code, org.secretCodeHash);
  }

  async listMembers(organizationId: string) {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        canManageOrg: roles.canManageOrg,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(users.createdAt));

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      roleId: r.roleId,
      roleName: r.roleName ?? "staff",
      canManageOrg: !!r.canManageOrg,
      createdAt: r.createdAt,
    }));
  }

  async assignRole(
    targetUserId: string,
    roleId: string,
    actor: Actor,
  ): Promise<void> {
    if (!actor.canManageOrg) throw new QueueError("Forbidden", "FORBIDDEN");
    const target = await this.db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!target[0] || target[0].organizationId !== actor.organizationId) {
      throw new QueueError("Member not found", "NOT_FOUND");
    }
    const role = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    if (!role[0] || role[0].organizationId !== actor.organizationId) {
      throw new QueueError("Role not found", "NOT_FOUND");
    }
    await this.db
      .update(users)
      .set({
        roleId: role[0].id,
        role: role[0].name,
        updatedAt: now(),
      })
      .where(eq(users.id, targetUserId));
  }

  async resolveActor(userId: string): Promise<Actor | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        organizationId: users.organizationId,
        roleId: users.roleId,
        roleName: roles.name,
        canManageOrg: roles.canManageOrg,
        canManageQueues: roles.canManageQueues,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      userId: r.userId,
      organizationId: r.organizationId,
      roleId: r.roleId,
      roleName: r.roleName ?? "staff",
      canManageOrg: !!r.canManageOrg,
      canManageQueues: r.canManageQueues == null ? true : !!r.canManageQueues,
    };
  }

  /**
   * Migrate legacy users without an organization into individual orgs.
   */
  async migrateLegacyUsers(): Promise<number> {
    const orphans = await this.db
      .select()
      .from(users)
      .where(sql`${users.organizationId} IS NULL`);
    let n = 0;
    for (const u of orphans) {
      const { org, managerRole } = await this.createIndividualOrg(u.username);
      await this.db
        .update(users)
        .set({
          organizationId: org.id,
          roleId: managerRole.id,
          role: "manager",
          updatedAt: now(),
        })
        .where(eq(users.id, u.id));
      // Claim unowned queues for this user if created_by matches
      n++;
    }
    return n;
  }
}
