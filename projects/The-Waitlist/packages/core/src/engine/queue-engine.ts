import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { queueEntries, queues } from "../db/schema";
import type {
  Actor,
  AddEntryInput,
  CreateQueueInput,
  EntryWithWait,
  Queue,
  QueueEntry,
  QueueScope,
  QueueWithStats,
  RealtimeEvent,
  UpdateEntryInput,
  UpdateQueueInput,
} from "../types";
import { QueueError } from "../types";
import {
  accessibleQueuesFilter,
  assertAccess,
  canAccessQueue,
  getQueueRoleIds,
  setQueueRoles,
} from "./access";
import { attachWaitEstimates } from "./wait";
import { createId, createPublicToken, createSlug } from "./ids";

type EventEmitter = (event: RealtimeEvent) => void;

function now(): Date {
  return new Date();
}

function toQueue(row: typeof queues.$inferSelect): Queue {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    avgServiceMinutes: row.avgServiceMinutes,
    organizationId: row.organizationId,
    ownerUserId: row.ownerUserId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    scope: (row.scope as QueueScope) ?? "personal",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEntry(row: typeof queueEntries.$inferSelect): QueueEntry {
  return {
    id: row.id,
    queueId: row.queueId,
    position: row.position,
    name: row.name,
    partySize: row.partySize,
    phone: row.phone,
    email: row.email,
    note: row.note,
    status: row.status,
    publicToken: row.publicToken,
    calledAt: row.calledAt,
    servedAt: row.servedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Queue engine — all queue business logic.
 * Works against any Drizzle SQLite database (local or embedded).
 */
export class QueueEngine {
  constructor(
    private db: Database,
    private emit: EventEmitter = () => {},
  ) {}

  private broadcast(
    type: RealtimeEvent["type"],
    queueId: string,
    payload: unknown,
    meta?: { organizationId?: string | null; userId?: string | null },
  ) {
    this.emit({
      type,
      queueId,
      organizationId: meta?.organizationId,
      userId: meta?.userId,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  private async requireQueueAccess(
    actor: Actor | null | undefined,
    idOrSlug: string,
  ): Promise<Queue> {
    const queue = await this.getQueue(idOrSlug);
    if (!actor) {
      // Public read path uses getQueuePublic only
      throw new QueueError("Authentication required", "FORBIDDEN");
    }
    assertAccess(await canAccessQueue(this.db, actor, queue));
    return queue;
  }

  // ─── Queues ───────────────────────────────────────────────────────────

  /** @deprecated prefer listQueuesFor(actor) */
  async listQueues(): Promise<QueueWithStats[]> {
    const rows = await this.db
      .select()
      .from(queues)
      .where(sql`${queues.status} != 'archived'`)
      .orderBy(desc(queues.updatedAt));

    const result: QueueWithStats[] = [];
    for (const row of rows) {
      const stats = await this.getQueueStats(row.id);
      const q = toQueue(row);
      q.roleIds = await getQueueRoleIds(this.db, q.id);
      result.push({ ...q, ...stats });
    }
    return result;
  }

  async listQueuesFor(actor: Actor): Promise<QueueWithStats[]> {
    const filter = accessibleQueuesFilter(actor);
    const rows = await this.db
      .select()
      .from(queues)
      .where(filter)
      .orderBy(desc(queues.updatedAt));

    const result: QueueWithStats[] = [];
    for (const row of rows) {
      const stats = await this.getQueueStats(row.id);
      const q = toQueue(row);
      q.roleIds = await getQueueRoleIds(this.db, q.id);
      result.push({ ...q, ...stats });
    }
    return result;
  }

  async getQueue(idOrSlug: string): Promise<Queue> {
    const row = await this.findQueueRow(idOrSlug);
    if (!row) throw new QueueError("Queue not found", "NOT_FOUND");
    const q = toQueue(row);
    q.roleIds = await getQueueRoleIds(this.db, q.id);
    return q;
  }

  async getQueueFor(actor: Actor, idOrSlug: string): Promise<Queue> {
    return this.requireQueueAccess(actor, idOrSlug);
  }

  async getQueueWithStats(idOrSlug: string): Promise<QueueWithStats> {
    const queue = await this.getQueue(idOrSlug);
    const stats = await this.getQueueStats(queue.id);
    return { ...queue, ...stats };
  }

  async getQueueWithStatsFor(
    actor: Actor,
    idOrSlug: string,
  ): Promise<QueueWithStats> {
    const queue = await this.requireQueueAccess(actor, idOrSlug);
    const stats = await this.getQueueStats(queue.id);
    return { ...queue, ...stats };
  }

  async createQueue(input: CreateQueueInput, actor?: Actor): Promise<Queue> {
    const name = input.name?.trim();
    if (!name || name.length < 1) {
      throw new QueueError("Queue name is required", "VALIDATION");
    }
    if (name.length > 80) {
      throw new QueueError("Queue name is too long (max 80)", "VALIDATION");
    }

    const scope: QueueScope = input.scope ?? "personal";
    if (!["personal", "organization", "roles"].includes(scope)) {
      throw new QueueError("Invalid scope", "VALIDATION");
    }

    if (actor) {
      if (!actor.organizationId) {
        throw new QueueError("User has no organization", "INVALID_STATE");
      }
      if (scope !== "personal" && !actor.canManageOrg && !actor.canManageQueues) {
        throw new QueueError("Cannot create shared queues", "FORBIDDEN");
      }
      if (scope === "organization" && actor.organizationId) {
        // team sharing OK
      }
      if (scope === "roles" && (!input.roleIds || input.roleIds.length === 0)) {
        throw new QueueError("Pick at least one role for role-shared queues", "VALIDATION");
      }
    }

    const id = createId("q");
    const slug = createSlug(name);
    const avg = input.avgServiceMinutes ?? 10;
    if (avg < 1 || avg > 240) {
      throw new QueueError("avgServiceMinutes must be 1–240", "VALIDATION");
    }

    const ts = now();
    const orgId = actor?.organizationId ?? input.organizationId ?? null;
    const ownerId = actor?.userId ?? input.ownerUserId ?? null;

    await this.db.insert(queues).values({
      id,
      name,
      slug,
      status: "active",
      avgServiceMinutes: avg,
      organizationId: orgId,
      ownerUserId: ownerId,
      createdByUserId: ownerId,
      scope,
      createdAt: ts,
      updatedAt: ts,
    });

    if (scope === "roles" && input.roleIds?.length) {
      await setQueueRoles(this.db, id, input.roleIds);
    }

    const queue = await this.getQueue(id);
    this.broadcast("queue.updated", id, queue, {
      organizationId: orgId,
      userId: ownerId,
    });
    this.broadcast("queue.list_changed", id, { action: "created" }, {
      organizationId: orgId,
      userId: ownerId,
    });
    return queue;
  }

  async updateQueue(
    idOrSlug: string,
    input: UpdateQueueInput,
    actor?: Actor,
  ): Promise<Queue> {
    const existing = actor
      ? await this.requireQueueAccess(actor, idOrSlug)
      : await this.getQueue(idOrSlug);

    if (actor && existing.ownerUserId !== actor.userId && !actor.canManageOrg) {
      throw new QueueError("Only owner or manager can edit settings", "FORBIDDEN");
    }

    const patch: Partial<typeof queues.$inferInsert> = {
      updatedAt: now(),
    };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new QueueError("Queue name is required", "VALIDATION");
      patch.name = name;
    }
    if (input.status !== undefined) patch.status = input.status;
    if (input.avgServiceMinutes !== undefined) {
      if (input.avgServiceMinutes < 1 || input.avgServiceMinutes > 240) {
        throw new QueueError("avgServiceMinutes must be 1–240", "VALIDATION");
      }
      patch.avgServiceMinutes = input.avgServiceMinutes;
    }
    if (input.scope !== undefined) {
      patch.scope = input.scope;
    }

    await this.db
      .update(queues)
      .set(patch)
      .where(eq(queues.id, existing.id));

    if (input.roleIds) {
      await setQueueRoles(this.db, existing.id, input.roleIds);
    } else if (input.scope === "personal" || input.scope === "organization") {
      await setQueueRoles(this.db, existing.id, []);
    }

    const queue = await this.getQueue(existing.id);
    this.broadcast("queue.updated", existing.id, queue, {
      organizationId: queue.organizationId,
      userId: queue.ownerUserId,
    });
    this.broadcast("queue.list_changed", existing.id, { action: "updated" }, {
      organizationId: queue.organizationId,
      userId: queue.ownerUserId,
    });
    return queue;
  }

  async archiveQueue(idOrSlug: string, actor?: Actor): Promise<Queue> {
    return this.updateQueue(idOrSlug, { status: "archived" }, actor);
  }

  /** Permanently delete a queue and all entries. Irreversible. */
  async deleteQueue(
    idOrSlug: string,
    confirmName: string,
    actor?: Actor,
  ): Promise<void> {
    const existing = actor
      ? await this.requireQueueAccess(actor, idOrSlug)
      : await this.getQueue(idOrSlug);
    if (actor && existing.ownerUserId !== actor.userId && !actor.canManageOrg) {
      throw new QueueError("Only owner or manager can delete", "FORBIDDEN");
    }
    if (confirmName.trim() !== existing.name) {
      throw new QueueError(
        "Confirmation name does not match queue name",
        "VALIDATION",
      );
    }
    const orgId = existing.organizationId;
    const ownerId = existing.ownerUserId;
    await this.db.delete(queues).where(eq(queues.id, existing.id));
    this.broadcast(
      "queue.updated",
      existing.id,
      { deleted: true, id: existing.id },
      { organizationId: orgId, userId: ownerId },
    );
    this.broadcast(
      "queue.list_changed",
      existing.id,
      { action: "deleted" },
      { organizationId: orgId, userId: ownerId },
    );
  }

  /**
   * Delete historical entries (served / no_show / cancelled only).
   * Pass `all: true` or a list of ids.
   */
  async deleteHistory(
    queueIdOrSlug: string,
    opts: { ids?: string[]; all?: boolean },
    actor?: Actor,
  ): Promise<{ deleted: number }> {
    const queue = actor
      ? await this.requireQueueAccess(actor, queueIdOrSlug)
      : await this.getQueue(queueIdOrSlug);
    if (!opts.all && (!opts.ids || opts.ids.length === 0)) {
      throw new QueueError("Provide ids or all: true", "VALIDATION");
    }
    if (opts.ids && opts.ids.length > 500) {
      throw new QueueError("Too many ids (max 500)", "VALIDATION");
    }

    const terminal = ["served", "no_show", "cancelled"] as const;

    if (opts.all) {
      const result = await this.db
        .delete(queueEntries)
        .where(
          and(
            eq(queueEntries.queueId, queue.id),
            inArray(queueEntries.status, [...terminal]),
          ),
        )
        .returning({ id: queueEntries.id });
      this.broadcast("entry.removed", queue.id, { historyCleared: true });
      return { deleted: result.length };
    }

    const ids = opts.ids!;
    const result = await this.db
      .delete(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queue.id),
          inArray(queueEntries.id, ids),
          inArray(queueEntries.status, [...terminal]),
        ),
      )
      .returning({ id: queueEntries.id });

    this.broadcast("entry.removed", queue.id, { deletedIds: result.map((r) => r.id) });
    return { deleted: result.length };
  }

  // ─── Entries ──────────────────────────────────────────────────────────

  async listActiveEntries(
    queueIdOrSlug: string,
    actor?: Actor,
  ): Promise<EntryWithWait[]> {
    const queue = actor
      ? await this.requireQueueAccess(actor, queueIdOrSlug)
      : await this.getQueue(queueIdOrSlug);
    const rows = await this.db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queue.id),
          inArray(queueEntries.status, ["waiting", "called"]),
        ),
      )
      .orderBy(
        // called first (status), then position
        sql`CASE WHEN ${queueEntries.status} = 'called' THEN 0 ELSE 1 END`,
        asc(queueEntries.position),
      );

    const entries = rows.map(toEntry);
    return attachWaitEstimates(entries, queue.avgServiceMinutes);
  }

  async listRecentHistory(
    queueIdOrSlug: string,
    limit = 50,
    actor?: Actor,
  ): Promise<QueueEntry[]> {
    const queue = actor
      ? await this.requireQueueAccess(actor, queueIdOrSlug)
      : await this.getQueue(queueIdOrSlug);
    const rows = await this.db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queue.id),
          inArray(queueEntries.status, ["served", "no_show", "cancelled"]),
        ),
      )
      .orderBy(desc(queueEntries.updatedAt))
      .limit(limit);
    return rows.map(toEntry);
  }

  async getEntry(entryId: string): Promise<QueueEntry> {
    const rows = await this.db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.id, entryId))
      .limit(1);
    if (!rows[0]) throw new QueueError("Entry not found", "NOT_FOUND");
    return toEntry(rows[0]);
  }

  async getEntryByToken(publicToken: string): Promise<{
    entry: EntryWithWait;
    queue: Queue;
  }> {
    const rows = await this.db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.publicToken, publicToken))
      .limit(1);
    if (!rows[0]) throw new QueueError("Entry not found", "NOT_FOUND");
    const entry = toEntry(rows[0]);
    const queue = await this.getQueue(entry.queueId);
    const active = await this.listActiveEntries(queue.id);
    const withWait = active.find((e) => e.id === entry.id);
    return {
      entry: withWait ?? { ...entry, estimatedWait: null },
      queue,
    };
  }

  async addEntry(
    queueIdOrSlug: string,
    input: AddEntryInput,
    actor?: Actor | null,
  ): Promise<QueueEntry> {
    // Public join passes actor=null explicitly; staff pass Actor
    const queue =
      actor === undefined
        ? await this.getQueue(queueIdOrSlug)
        : actor
          ? await this.requireQueueAccess(actor, queueIdOrSlug)
          : await this.getQueue(queueIdOrSlug);
    if (queue.status === "archived") {
      throw new QueueError("Cannot add to an archived queue", "INVALID_STATE");
    }
    if (queue.status === "paused") {
      throw new QueueError("Queue is paused", "INVALID_STATE");
    }

    const name = input.name?.trim();
    if (!name) throw new QueueError("Name is required", "VALIDATION");
    if (name.length > 100) {
      throw new QueueError("Name is too long (max 100)", "VALIDATION");
    }

    const partySize = input.partySize ?? 1;
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 99) {
      throw new QueueError("partySize must be 1–99", "VALIDATION");
    }

    const maxPos = await this.db
      .select({
        max: sql<number | null>`max(${queueEntries.position})`,
      })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queue.id),
          inArray(queueEntries.status, ["waiting", "called"]),
          isNotNull(queueEntries.position),
        ),
      );

    const position = (maxPos[0]?.max ?? 0) + 1;
    const id = createId("e");
    const ts = now();

    await this.db.insert(queueEntries).values({
      id,
      queueId: queue.id,
      position,
      name,
      partySize,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      note: input.note?.trim() || null,
      status: "waiting",
      publicToken: createPublicToken(),
      calledAt: null,
      servedAt: null,
      createdAt: ts,
      updatedAt: ts,
    });

    await this.touchQueue(queue.id);
    const entry = await this.getEntry(id);
    this.broadcast("entry.added", queue.id, entry);
    return entry;
  }

  async updateEntry(
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<QueueEntry> {
    const existing = await this.getEntry(entryId);
    const patch: Partial<typeof queueEntries.$inferInsert> = {
      updatedAt: now(),
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new QueueError("Name is required", "VALIDATION");
      patch.name = name;
    }
    if (input.partySize !== undefined) {
      if (
        !Number.isInteger(input.partySize) ||
        input.partySize < 1 ||
        input.partySize > 99
      ) {
        throw new QueueError("partySize must be 1–99", "VALIDATION");
      }
      patch.partySize = input.partySize;
    }
    if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
    if (input.email !== undefined) patch.email = input.email?.trim() || null;
    if (input.note !== undefined) patch.note = input.note?.trim() || null;

    // Status transitions go through dedicated methods for side effects,
    // but allow simple updates for non-terminal → terminal via mark helpers.
    if (input.status !== undefined && input.status !== existing.status) {
      if (input.status === "served") return this.markServed(entryId);
      if (input.status === "no_show") return this.markNoShow(entryId);
      if (input.status === "cancelled") return this.cancelEntry(entryId);
      if (input.status === "called") return this.callEntry(entryId);
      if (input.status === "waiting" && existing.status === "called") {
        patch.status = "waiting";
        patch.calledAt = null;
      } else {
        throw new QueueError(
          `Cannot transition ${existing.status} → ${input.status}`,
          "INVALID_STATE",
        );
      }
    }

    await this.db
      .update(queueEntries)
      .set(patch)
      .where(eq(queueEntries.id, entryId));

    await this.touchQueue(existing.queueId);
    const entry = await this.getEntry(entryId);
    this.broadcast("entry.updated", existing.queueId, entry);
    return entry;
  }

  /**
   * Call the next waiting party (lowest position).
   * If someone is already "called", they stay called — next is still advanced.
   */
  async callNext(
    queueIdOrSlug: string,
    actor?: Actor,
  ): Promise<QueueEntry | null> {
    const queue = actor
      ? await this.requireQueueAccess(actor, queueIdOrSlug)
      : await this.getQueue(queueIdOrSlug);
    const rows = await this.db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queue.id),
          eq(queueEntries.status, "waiting"),
        ),
      )
      .orderBy(asc(queueEntries.position))
      .limit(1);

    if (!rows[0]) return null;
    return this.callEntry(rows[0].id);
  }

  async callEntry(entryId: string): Promise<QueueEntry> {
    const existing = await this.getEntry(entryId);
    if (existing.status !== "waiting" && existing.status !== "called") {
      throw new QueueError(
        "Only waiting entries can be called",
        "INVALID_STATE",
      );
    }

    const ts = now();
    await this.db
      .update(queueEntries)
      .set({ status: "called", calledAt: ts, updatedAt: ts })
      .where(eq(queueEntries.id, entryId));

    await this.touchQueue(existing.queueId);
    const entry = await this.getEntry(entryId);
    this.broadcast("entry.called", existing.queueId, entry);
    return entry;
  }

  async markServed(entryId: string): Promise<QueueEntry> {
    const existing = await this.getEntry(entryId);
    if (
      existing.status !== "waiting" &&
      existing.status !== "called"
    ) {
      throw new QueueError(
        "Only waiting/called entries can be marked served",
        "INVALID_STATE",
      );
    }

    const ts = now();
    await this.db
      .update(queueEntries)
      .set({
        status: "served",
        position: null,
        servedAt: ts,
        updatedAt: ts,
        calledAt: existing.calledAt ?? ts,
      })
      .where(eq(queueEntries.id, entryId));

    await this.repackPositions(existing.queueId);
    await this.touchQueue(existing.queueId);
    const entry = await this.getEntry(entryId);
    this.broadcast("entry.served", existing.queueId, entry);
    return entry;
  }

  async markNoShow(entryId: string): Promise<QueueEntry> {
    const existing = await this.getEntry(entryId);
    if (
      existing.status !== "waiting" &&
      existing.status !== "called"
    ) {
      throw new QueueError(
        "Only waiting/called entries can be marked no-show",
        "INVALID_STATE",
      );
    }

    const ts = now();
    await this.db
      .update(queueEntries)
      .set({
        status: "no_show",
        position: null,
        updatedAt: ts,
      })
      .where(eq(queueEntries.id, entryId));

    await this.repackPositions(existing.queueId);
    await this.touchQueue(existing.queueId);
    const entry = await this.getEntry(entryId);
    this.broadcast("entry.no_show", existing.queueId, entry);
    return entry;
  }

  async cancelEntry(entryId: string): Promise<QueueEntry> {
    const existing = await this.getEntry(entryId);
    if (
      existing.status !== "waiting" &&
      existing.status !== "called"
    ) {
      throw new QueueError(
        "Only waiting/called entries can be cancelled",
        "INVALID_STATE",
      );
    }

    const ts = now();
    await this.db
      .update(queueEntries)
      .set({
        status: "cancelled",
        position: null,
        updatedAt: ts,
      })
      .where(eq(queueEntries.id, entryId));

    await this.repackPositions(existing.queueId);
    await this.touchQueue(existing.queueId);
    const entry = await this.getEntry(entryId);
    this.broadcast("entry.removed", existing.queueId, entry);
    return entry;
  }

  /**
   * Reorder: move entry to a new 1-based position among waiting+called.
   * Positions are re-normalized after the move.
   */
  async reorderEntry(
    entryId: string,
    newPosition: number,
  ): Promise<EntryWithWait[]> {
    if (!Number.isInteger(newPosition) || newPosition < 1) {
      throw new QueueError("newPosition must be a positive integer", "VALIDATION");
    }

    const existing = await this.getEntry(entryId);
    if (existing.status !== "waiting" && existing.status !== "called") {
      throw new QueueError(
        "Only active entries can be reordered",
        "INVALID_STATE",
      );
    }

    const active = await this.db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, existing.queueId),
          inArray(queueEntries.status, ["waiting", "called"]),
        ),
      )
      .orderBy(asc(queueEntries.position));

    const ordered = active.map(toEntry);
    const fromIdx = ordered.findIndex((e) => e.id === entryId);
    if (fromIdx === -1) {
      throw new QueueError("Entry not in active list", "INVALID_STATE");
    }

    const [moved] = ordered.splice(fromIdx, 1);
    const toIdx = Math.min(newPosition - 1, ordered.length);
    ordered.splice(toIdx, 0, moved);

    // Write new positions
    for (let i = 0; i < ordered.length; i++) {
      await this.db
        .update(queueEntries)
        .set({ position: i + 1, updatedAt: now() })
        .where(eq(queueEntries.id, ordered[i].id));
    }

    await this.touchQueue(existing.queueId);
    const result = await this.listActiveEntries(existing.queueId);
    this.broadcast("entry.reordered", existing.queueId, result);
    return result;
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async findQueueRow(idOrSlug: string) {
    const byId = await this.db
      .select()
      .from(queues)
      .where(eq(queues.id, idOrSlug))
      .limit(1);
    if (byId[0]) return byId[0];

    const bySlug = await this.db
      .select()
      .from(queues)
      .where(eq(queues.slug, idOrSlug))
      .limit(1);
    return bySlug[0] ?? null;
  }

  private async getQueueStats(queueId: string) {
    const active = await this.db
      .select({
        status: queueEntries.status,
        count: sql<number>`count(*)`,
      })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queueId),
          inArray(queueEntries.status, ["waiting", "called"]),
        ),
      )
      .groupBy(queueEntries.status);

    let waitingCount = 0;
    let calledCount = 0;
    for (const row of active) {
      if (row.status === "waiting") waitingCount = Number(row.count);
      if (row.status === "called") calledCount = Number(row.count);
    }

    // Served today (local day boundary — good enough for MVP)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const served = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queueId),
          eq(queueEntries.status, "served"),
          sql`${queueEntries.servedAt} >= ${startOfDay.getTime()}`,
        ),
      );

    return {
      waitingCount,
      calledCount,
      servedToday: Number(served[0]?.count ?? 0),
    };
  }

  /** Re-number active entries 1..n after removals. */
  private async repackPositions(queueId: string) {
    const active = await this.db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.queueId, queueId),
          inArray(queueEntries.status, ["waiting", "called"]),
        ),
      )
      .orderBy(asc(queueEntries.position), asc(queueEntries.createdAt));

    for (let i = 0; i < active.length; i++) {
      const desired = i + 1;
      if (active[i].position !== desired) {
        await this.db
          .update(queueEntries)
          .set({ position: desired, updatedAt: now() })
          .where(eq(queueEntries.id, active[i].id));
      }
    }
  }

  private async touchQueue(queueId: string) {
    await this.db
      .update(queues)
      .set({ updatedAt: now() })
      .where(eq(queues.id, queueId));
  }
}
