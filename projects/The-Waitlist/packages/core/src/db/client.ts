import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(path: string) {
  const sqlite = new BunDatabase(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  return drizzle(sqlite, { schema });
}

function tryExec(sqlite: BunDatabase, sql: string) {
  try {
    sqlite.exec(sql);
  } catch {
    // already exists / not applicable
  }
}

/** Apply schema for fresh DBs + soft migrations for existing installs. */
export function ensureSchema(dbPath: string) {
  const sqlite = new BunDatabase(dbPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Base tables (IF NOT EXISTS — won't alter existing shapes)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'individual',
      contact_email TEXT,
      secret_code_hash TEXT,
      secret_code_expires_at INTEGER,
      secret_code_version INTEGER NOT NULL DEFAULT 0,
      org_features_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      can_manage_org INTEGER NOT NULL DEFAULT 0,
      can_manage_queues INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      ip_hash TEXT,
      user_agent_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      avg_service_minutes INTEGER NOT NULL DEFAULT 10,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      scope TEXT NOT NULL DEFAULT 'personal',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS queue_roles (
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY NOT NULL,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      position INTEGER,
      name TEXT NOT NULL,
      party_size INTEGER NOT NULL DEFAULT 1,
      phone TEXT,
      email TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      public_token TEXT NOT NULL UNIQUE,
      called_at INTEGER,
      served_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);

  // Soft migrations for older installs (columns may already exist)
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN type TEXT NOT NULL DEFAULT 'individual'`);
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN contact_email TEXT`);
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN secret_code_hash TEXT`);
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN secret_code_expires_at INTEGER`);
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN secret_code_version INTEGER NOT NULL DEFAULT 0`);
  tryExec(sqlite, `ALTER TABLE organizations ADD COLUMN org_features_enabled INTEGER NOT NULL DEFAULT 1`);
  tryExec(sqlite, `ALTER TABLE users ADD COLUMN organization_id TEXT`);
  tryExec(sqlite, `ALTER TABLE users ADD COLUMN role_id TEXT`);
  tryExec(sqlite, `ALTER TABLE queues ADD COLUMN owner_user_id TEXT`);
  tryExec(sqlite, `ALTER TABLE queues ADD COLUMN created_by_user_id TEXT`);
  tryExec(sqlite, `ALTER TABLE queues ADD COLUMN scope TEXT NOT NULL DEFAULT 'personal'`);

  // Indexes after columns exist
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS orgs_type_idx ON organizations(type)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS orgs_name_idx ON organizations(name)`);
  tryExec(sqlite, `CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_uidx ON roles(organization_id, name)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS roles_org_idx ON roles(organization_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS users_username_idx ON users(username)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS users_org_idx ON users(organization_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS queues_org_idx ON queues(organization_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS queues_owner_idx ON queues(owner_user_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS queues_scope_idx ON queues(scope)`);
  tryExec(sqlite, `CREATE UNIQUE INDEX IF NOT EXISTS queue_roles_uidx ON queue_roles(queue_id, role_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS queue_roles_role_idx ON queue_roles(role_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS entries_queue_idx ON queue_entries(queue_id)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS entries_queue_status_idx ON queue_entries(queue_id, status)`);
  tryExec(sqlite, `CREATE INDEX IF NOT EXISTS entries_queue_position_idx ON queue_entries(queue_id, position)`);

  sqlite.close();
}
