import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Multi-tenant schema (local + managed).
 *
 * - individual org: one person, personal queues only
 * - team org: manager + members, secret-code join, role-based queue sharing
 * - queue.scope: personal | organization | roles
 */

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** individual = solo account shell; team = multi-member org */
    type: text("type", { enum: ["individual", "team"] })
      .notNull()
      .default("individual"),
    /** Manager contact — used for daily secret code delivery (managed) */
    contactEmail: text("contact_email"),
    /** argon2id / sha256 of current join secret (null for individual) */
    secretCodeHash: text("secret_code_hash"),
    secretCodeExpiresAt: integer("secret_code_expires_at", {
      mode: "timestamp_ms",
    }),
    /** Bump when code rotates */
    secretCodeVersion: integer("secret_code_version").notNull().default(0),
    /** Local-only: when true, team features are active on this instance */
    orgFeaturesEnabled: integer("org_features_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("orgs_type_idx").on(t.type),
    index("orgs_name_idx").on(t.name),
  ],
);

/** Custom + system roles within an organization */
export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** e.g. manager, staff, receptionist, waiter, chef */
    name: text("name").notNull(),
    /** system roles cannot be deleted */
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    /** Can manage members, roles, secret code */
    canManageOrg: integer("can_manage_org", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Can create org-scoped / role-scoped queues */
    canManageQueues: integer("can_manage_queues", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("roles_org_name_uidx").on(t.organizationId, t.name),
    index("roles_org_idx").on(t.organizationId),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email").unique(),
    passwordHash: text("password_hash").notNull(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** Primary role in their organization */
    roleId: text("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    /** Legacy field kept for soft migration; prefer roleId */
    role: text("role").notNull().default("staff"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("users_username_idx").on(t.username),
    index("users_org_idx").on(t.organizationId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    csrfToken: text("csrf_token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const queues = sqliteTable(
  "queues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status", { enum: ["active", "paused", "archived"] })
      .notNull()
      .default("active"),
    avgServiceMinutes: integer("avg_service_minutes").notNull().default(10),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** Always the creator — personal queues visible only to this user (unless manager) */
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /**
     * personal — only owner (+ managers can oversee)
     * organization — every member of the org
     * roles — members whose role is linked in queue_roles
     */
    scope: text("scope", { enum: ["personal", "organization", "roles"] })
      .notNull()
      .default("personal"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("queues_org_idx").on(t.organizationId),
    index("queues_owner_idx").on(t.ownerUserId),
    index("queues_scope_idx").on(t.scope),
  ],
);

/** Which roles can access a scope=roles queue */
export const queueRoles = sqliteTable(
  "queue_roles",
  {
    queueId: text("queue_id")
      .notNull()
      .references(() => queues.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("queue_roles_uidx").on(t.queueId, t.roleId),
    index("queue_roles_role_idx").on(t.roleId),
  ],
);

export const queueEntries = sqliteTable(
  "queue_entries",
  {
    id: text("id").primaryKey(),
    queueId: text("queue_id")
      .notNull()
      .references(() => queues.id, { onDelete: "cascade" }),
    position: integer("position"),
    name: text("name").notNull(),
    partySize: integer("party_size").notNull().default(1),
    phone: text("phone"),
    email: text("email"),
    note: text("note"),
    status: text("status", {
      enum: ["waiting", "called", "served", "no_show", "cancelled"],
    })
      .notNull()
      .default("waiting"),
    publicToken: text("public_token").notNull().unique(),
    calledAt: integer("called_at", { mode: "timestamp_ms" }),
    servedAt: integer("served_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("entries_queue_idx").on(t.queueId),
    index("entries_queue_status_idx").on(t.queueId, t.status),
    index("entries_queue_position_idx").on(t.queueId, t.position),
  ],
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type QueueRow = typeof queues.$inferSelect;
export type QueueEntryRow = typeof queueEntries.$inferSelect;
