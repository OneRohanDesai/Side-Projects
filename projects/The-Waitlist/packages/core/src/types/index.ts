/** Entry status in a queue */
export type EntryStatus = "waiting" | "called" | "served" | "no_show" | "cancelled";

/** Queue lifecycle status */
export type QueueStatus = "active" | "paused" | "archived";

/** Who can see/edit a queue */
export type QueueScope = "personal" | "organization" | "roles";

export type OrgType = "individual" | "team";

export type StaffRole = "manager" | "staff" | string;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  contactEmail: string | null;
  secretCodeExpiresAt: Date | null;
  secretCodeVersion: number;
  orgFeaturesEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgPublic {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  isSystem: boolean;
  canManageOrg: boolean;
  canManageQueues: boolean;
  createdAt: Date;
}

export interface Queue {
  id: string;
  name: string;
  slug: string;
  status: QueueStatus;
  avgServiceMinutes: number;
  organizationId: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  scope: QueueScope;
  roleIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueEntry {
  id: string;
  queueId: string;
  position: number | null;
  name: string;
  partySize: number;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: EntryStatus;
  publicToken: string;
  calledAt: Date | null;
  servedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQueueInput {
  name: string;
  avgServiceMinutes?: number;
  organizationId?: string | null;
  ownerUserId?: string | null;
  scope?: QueueScope;
  roleIds?: string[];
}

export interface UpdateQueueInput {
  name?: string;
  status?: QueueStatus;
  avgServiceMinutes?: number;
  scope?: QueueScope;
  roleIds?: string[];
}

export interface AddEntryInput {
  name: string;
  partySize?: number;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}

export interface UpdateEntryInput {
  name?: string;
  partySize?: number;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  status?: EntryStatus;
}

export interface EstimatedWait {
  minutes: number;
  partiesAhead: number;
  peopleAhead: number;
}

export interface QueueWithStats extends Queue {
  waitingCount: number;
  calledCount: number;
  servedToday: number;
}

export interface EntryWithWait extends QueueEntry {
  estimatedWait: EstimatedWait | null;
}

export interface Actor {
  userId: string;
  organizationId: string | null;
  roleId: string | null;
  roleName: string;
  canManageOrg: boolean;
  canManageQueues: boolean;
}

export type RealtimeEventType =
  | "queue.updated"
  | "queue.list_changed"
  | "entry.added"
  | "entry.updated"
  | "entry.removed"
  | "entry.reordered"
  | "entry.called"
  | "entry.served"
  | "entry.no_show"
  | "org.updated"
  | "members.updated";

export interface RealtimeEvent {
  type: RealtimeEventType;
  queueId: string;
  organizationId?: string | null;
  userId?: string | null;
  payload: unknown;
  timestamp: string;
}

export class QueueError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "VALIDATION"
      | "CONFLICT"
      | "FORBIDDEN",
  ) {
    super(message);
    this.name = "QueueError";
  }
}

export interface PublicUser {
  id: string;
  username: string;
  role: StaffRole;
  roleId: string | null;
  roleName: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationType: OrgType | null;
  canManageOrg: boolean;
}
