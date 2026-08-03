import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { queueRoles, queues } from "../db/schema";
import type { Actor, Queue } from "../types";
import { QueueError } from "../types";

/**
 * Can this actor see/manage the queue?
 * - managers: all queues in their org
 * - personal: owner only
 * - organization: any member of org
 * - roles: member's role is linked
 */
export async function canAccessQueue(
  db: Database,
  actor: Actor,
  queue: Pick<
    Queue,
    "id" | "organizationId" | "ownerUserId" | "scope"
  >,
): Promise<boolean> {
  if (!actor.organizationId || queue.organizationId !== actor.organizationId) {
    // Cross-org only if personal owner somehow
    return queue.ownerUserId === actor.userId && queue.scope === "personal";
  }
  if (actor.canManageOrg) return true;
  if (queue.scope === "personal") {
    return queue.ownerUserId === actor.userId;
  }
  if (queue.scope === "organization") return true;
  if (queue.scope === "roles") {
    if (!actor.roleId) return false;
    const links = await db
      .select()
      .from(queueRoles)
      .where(
        and(
          eq(queueRoles.queueId, queue.id),
          eq(queueRoles.roleId, actor.roleId),
        ),
      )
      .limit(1);
    return !!links[0];
  }
  return false;
}

export function assertAccess(ok: boolean, msg = "Forbidden") {
  if (!ok) throw new QueueError(msg, "FORBIDDEN");
}

/** SQL filter fragment for listQueues for a given actor */
export function accessibleQueuesFilter(actor: Actor) {
  if (!actor.organizationId) {
    return eq(queues.ownerUserId, actor.userId);
  }

  if (actor.canManageOrg) {
    return and(
      eq(queues.organizationId, actor.organizationId),
      sql`${queues.status} != 'archived'`,
    );
  }

  // personal owned OR organization scope OR roles match
  const roleClause = actor.roleId
    ? sql`${queues.id} IN (SELECT queue_id FROM queue_roles WHERE role_id = ${actor.roleId})`
    : sql`0`;

  return and(
    eq(queues.organizationId, actor.organizationId),
    sql`${queues.status} != 'archived'`,
    or(
      and(eq(queues.scope, "personal"), eq(queues.ownerUserId, actor.userId)),
      eq(queues.scope, "organization"),
      and(eq(queues.scope, "roles"), roleClause),
    ),
  );
}

export async function setQueueRoles(
  db: Database,
  queueId: string,
  roleIds: string[],
) {
  await db.delete(queueRoles).where(eq(queueRoles.queueId, queueId));
  for (const roleId of roleIds) {
    await db.insert(queueRoles).values({ queueId, roleId });
  }
}

export async function getQueueRoleIds(
  db: Database,
  queueId: string,
): Promise<string[]> {
  const rows = await db
    .select({ roleId: queueRoles.roleId })
    .from(queueRoles)
    .where(eq(queueRoles.queueId, queueId));
  return rows.map((r) => r.roleId);
}
