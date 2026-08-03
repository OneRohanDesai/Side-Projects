const BASE = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? "";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD" && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? res.statusText,
      res.status,
      data?.error?.code,
    );
  }
  return data as T;
}

export type QueueStatus = "active" | "paused" | "archived";
export type EntryStatus =
  | "waiting"
  | "called"
  | "served"
  | "no_show"
  | "cancelled";
export type QueueScope = "personal" | "organization" | "roles";
export type OrgType = "individual" | "team";

export interface Queue {
  id: string;
  name: string;
  slug: string;
  status: QueueStatus;
  avgServiceMinutes: number;
  organizationId: string | null;
  ownerUserId?: string | null;
  scope?: QueueScope;
  roleIds?: string[];
  createdAt: string;
  updatedAt: string;
  waitingCount?: number;
  calledCount?: number;
  servedToday?: number;
}

export interface EstimatedWait {
  minutes: number;
  partiesAhead: number;
  peopleAhead: number;
}

export interface Entry {
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
  calledAt: string | null;
  servedAt: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedWait?: EstimatedWait | null;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  roleId: string | null;
  roleName: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationType: OrgType | null;
  canManageOrg: boolean;
}

export interface AuthStatus {
  needsBootstrap: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  csrfToken: string | null;
  appMode?: string;
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
}

export interface Member {
  id: string;
  username: string;
  email: string | null;
  roleId: string | null;
  roleName: string;
  canManageOrg: boolean;
  createdAt: string;
}

export type SignupBody =
  | {
      mode: "individual";
      username: string;
      password: string;
      email?: string;
    }
  | {
      mode: "join";
      username: string;
      password: string;
      email?: string;
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

export const api = {
  health: () => request<{ ok: boolean; mode: string }>("/api/health"),

  network: () =>
    request<{ lan: string[]; urls: string[]; port: number; hint: string }>(
      "/api/network",
    ),

  authStatus: async () => {
    const res = await request<AuthStatus>("/api/auth/status");
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res;
  },

  signup: async (body: SignupBody) => {
    const res = await request<{
      user: AuthUser;
      csrfToken: string;
      expiresAt: string;
      joinSecretCode: string | null;
    }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setCsrfToken(res.csrfToken);
    return res;
  },

  login: async (body: { username: string; password: string }) => {
    const res = await request<{
      user: AuthUser;
      csrfToken: string;
      expiresAt: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setCsrfToken(res.csrfToken);
    return res;
  },

  logout: async () => {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    setCsrfToken(null);
  },

  searchOrgs: (q: string) =>
    request<{ organizations: OrgPublic[] }>(
      `/api/orgs/search?q=${encodeURIComponent(q)}`,
    ),

  myOrg: () =>
    request<{
      organization: {
        id: string;
        name: string;
        type: OrgType;
        contactEmail: string | null;
        secretCodeExpiresAt: string | null;
      } | null;
      roles: Role[];
      members: Member[];
    }>("/api/orgs/mine"),

  rotateJoinCode: () =>
    request<{
      secretCode: string;
      deliveredTo: string | null;
      note: string;
    }>("/api/orgs/mine/rotate-code", { method: "POST" }),

  createRole: (name: string) =>
    request<{ role: Role }>("/api/orgs/mine/roles", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  deleteRole: (roleId: string) =>
    request<{ ok: boolean }>(`/api/orgs/mine/roles/${roleId}`, {
      method: "DELETE",
    }),

  assignMemberRole: (userId: string, roleId: string) =>
    request<{ ok: boolean }>(`/api/orgs/mine/members/${userId}/role`, {
      method: "POST",
      body: JSON.stringify({ roleId }),
    }),

  listQueues: () => request<{ queues: Queue[] }>("/api/queues"),

  getQueue: (id: string) => request<{ queue: Queue }>(`/api/queues/${id}`),

  createQueue: (body: {
    name: string;
    avgServiceMinutes?: number;
    scope?: QueueScope;
    roleIds?: string[];
  }) =>
    request<{ queue: Queue }>("/api/queues", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateQueue: (
    id: string,
    body: Partial<{
      name: string;
      status: QueueStatus;
      avgServiceMinutes: number;
      scope: QueueScope;
      roleIds: string[];
    }>,
  ) =>
    request<{ queue: Queue }>(`/api/queues/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  archiveQueue: (id: string) =>
    request<{ queue: Queue }>(`/api/queues/${id}`, { method: "DELETE" }),

  destroyQueue: (id: string, confirmName: string) =>
    request<{ ok: boolean }>(`/api/queues/${id}/destroy`, {
      method: "POST",
      body: JSON.stringify({ confirmName }),
    }),

  listEntries: (queueId: string) =>
    request<{ entries: Entry[] }>(`/api/queues/${queueId}/entries`),

  listHistory: (queueId: string, limit = 50) =>
    request<{ entries: Entry[] }>(
      `/api/queues/${queueId}/history?limit=${limit}`,
    ),

  deleteHistory: (queueId: string, body: { ids?: string[]; all?: boolean }) =>
    request<{ deleted: number }>(`/api/queues/${queueId}/history/delete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addEntry: (
    queueId: string,
    body: {
      name: string;
      partySize?: number;
      phone?: string | null;
      email?: string | null;
      note?: string | null;
    },
  ) =>
    request<{ entry: Entry }>(`/api/queues/${queueId}/entries`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  callNext: (queueId: string) =>
    request<{ entry: Entry | null }>(`/api/queues/${queueId}/call-next`, {
      method: "POST",
    }),

  callEntry: (id: string) =>
    request<{ entry: Entry }>(`/api/entries/${id}/call`, { method: "POST" }),

  serveEntry: (id: string) =>
    request<{ entry: Entry }>(`/api/entries/${id}/serve`, { method: "POST" }),

  noShowEntry: (id: string) =>
    request<{ entry: Entry }>(`/api/entries/${id}/no-show`, { method: "POST" }),

  cancelEntry: (id: string) =>
    request<{ entry: Entry }>(`/api/entries/${id}/cancel`, { method: "POST" }),

  reorderEntry: (id: string, position: number) =>
    request<{ entries: Entry[] }>(`/api/entries/${id}/reorder`, {
      method: "POST",
      body: JSON.stringify({ position }),
    }),

  updateEntry: (
    id: string,
    body: Partial<{
      name: string;
      partySize: number;
      phone: string | null;
      email: string | null;
      note: string | null;
    }>,
  ) =>
    request<{ entry: Entry }>(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  publicQueue: (slug: string) =>
    request<{
      queue: Pick<
        Queue,
        "id" | "name" | "slug" | "status" | "waitingCount" | "avgServiceMinutes"
      >;
    }>(`/api/public/queue/${slug}`),

  publicJoin: (
    slug: string,
    body: {
      name: string;
      partySize?: number;
      phone?: string | null;
      email?: string | null;
      note?: string | null;
    },
  ) =>
    request<{ entry: Entry }>(`/api/public/join/${slug}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  publicStatus: (token: string) =>
    request<{
      entry: Pick<
        Entry,
        | "id"
        | "name"
        | "partySize"
        | "status"
        | "position"
        | "estimatedWait"
        | "publicToken"
      >;
      queue: Pick<Queue, "id" | "name" | "slug">;
    }>(`/api/public/status/${token}`),
};
