import type { RealtimeEvent } from "@the-waitlist/core";
import type { ServerWebSocket } from "bun";

export type ClientData = {
  queues: Set<string>;
  /** org room for list + member updates */
  organizationId: string | null;
  userId: string | null;
  role: "staff" | "public";
};

/**
 * WebSocket hub with queue / organization / user targeting.
 * Multi-device same account: all sockets with same userId/org receive events.
 */
export class RealtimeHub {
  private clients = new Set<ServerWebSocket<ClientData>>();

  add(ws: ServerWebSocket<ClientData>) {
    this.clients.add(ws);
  }

  remove(ws: ServerWebSocket<ClientData>) {
    this.clients.delete(ws);
  }

  bindIdentity(
    ws: ServerWebSocket<ClientData>,
    identity: { userId: string | null; organizationId: string | null },
  ) {
    ws.data.userId = identity.userId;
    ws.data.organizationId = identity.organizationId;
  }

  subscribe(ws: ServerWebSocket<ClientData>, queueId: string) {
    ws.data.queues.add(queueId);
  }

  unsubscribe(ws: ServerWebSocket<ClientData>, queueId: string) {
    ws.data.queues.delete(queueId);
  }

  broadcast(event: RealtimeEvent) {
    const message = JSON.stringify(event);
    for (const client of this.clients) {
      if (!this.shouldReceive(client, event)) continue;
      try {
        client.send(message);
      } catch {
        // drop broken
      }
    }
  }

  private shouldReceive(
    client: ServerWebSocket<ClientData>,
    event: RealtimeEvent,
  ): boolean {
    // Explicit queue subscription always receives that queue's events
    if (event.queueId && client.data.queues.has(event.queueId)) return true;

    // Org-wide list / member events
    if (
      event.organizationId &&
      client.data.organizationId &&
      event.organizationId === client.data.organizationId
    ) {
      if (
        event.type === "queue.list_changed" ||
        event.type === "org.updated" ||
        event.type === "members.updated" ||
        event.type === "queue.updated"
      ) {
        return true;
      }
      // Entry events for org-scoped work: if subscribed to queue OR listening to org dashboard
      if (event.type.startsWith("entry.")) {
        // Dashboard with empty queue set still gets org entry noise — limit to subscribed queues
        // unless they have no subscriptions (dashboard-wide listen)
        if (client.data.queues.size === 0) return true;
      }
    }

    // Personal queue events for owner devices
    if (
      event.userId &&
      client.data.userId &&
      event.userId === client.data.userId
    ) {
      if (
        event.type === "queue.list_changed" ||
        event.type === "queue.updated" ||
        event.type.startsWith("entry.")
      ) {
        return true;
      }
    }

    return false;
  }

  get clientCount() {
    return this.clients.size;
  }
}
