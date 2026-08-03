import type { AuthState, Catalog, CuratedResponse, PlaylistDetail } from "../types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText || "Request failed");
  }
  return data as T;
}

export const api = {
  me: () => req<AuthState>("/api/auth/me"),
  token: () => req<{ access_token: string; expires_at: number }>("/api/auth/token"),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  catalog: () => req<Catalog>("/api/catalog"),
  playlist: (id: string) => req<PlaylistDetail>(`/api/catalog/playlists/${id}`),

  curated: () => req<CuratedResponse>("/api/studio/curated"),
  saveCurated: (links: string) =>
    req<CuratedResponse & { ok: boolean }>("/api/studio/curated", {
      method: "PUT",
      body: JSON.stringify({ links }),
    }),
  addCurated: (links: string) =>
    req<CuratedResponse & { ok: boolean; added: number }>("/api/studio/curated/add", {
      method: "POST",
      body: JSON.stringify({ links }),
    }),
  removeCurated: (id: string) =>
    req<{ ok: boolean; playlistIds: string[] }>(`/api/studio/curated/${id}`, {
      method: "DELETE",
    }),
  publish: (links?: string) =>
    req<{ ok: boolean; catalog: Catalog; count: number; totalTracks: number }>(
      "/api/studio/publish",
      {
        method: "POST",
        body: JSON.stringify(links ? { links } : {}),
      },
    ),

  play: (body: {
    device_id: string;
    uris?: string[];
    context_uri?: string;
    offset?: { position?: number; uri?: string };
  }) => req<{ ok: boolean }>("/api/player/play", { method: "PUT", body: JSON.stringify(body) }),
  transfer: (device_id: string, play = false) =>
    req<{ ok: boolean }>("/api/player/transfer", {
      method: "PUT",
      body: JSON.stringify({ device_id, play }),
    }),
};

export function loginRedirect() {
  // Full navigation (not fetch) so Set-Cookie + Spotify redirect work
  window.location.href = `/api/auth/login?t=${Date.now()}`;
}
