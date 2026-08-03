import type { Env, PlaylistDetail, PlaylistSummary, SessionData, TrackItem } from "./types";

const SPOTIFY_AUTH = "https://accounts.spotify.com";
const SPOTIFY_API = "https://api.spotify.com/v1";

export const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export function authUrl(env: Env, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    state,
    show_dialog: "false",
  });
  return `${SPOTIFY_AUTH}/authorize?${params}`;
}

async function basicAuth(env: Env): Promise<string> {
  return btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
}

export async function exchangeCode(env: Env, code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });
  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${await basicAuth(env)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${await basicAuth(env)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function spotifyFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${SPOTIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function getMe(accessToken: string): Promise<{
  id: string;
  display_name: string;
  product: string;
}> {
  const res = await spotifyFetch(accessToken, "/me");
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

type SpotifyImage = { url: string; height: number | null; width: number | null };
type SpotifyPlaylist = {
  id: string;
  uri: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string | null; id: string };
  public: boolean | null;
};

type SpotifyTrack = {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  artists: { name: string }[];
  is_local?: boolean;
};

function pickImage(images: SpotifyImage[]): string | null {
  if (!images?.length) return null;
  // Prefer mid-size for speed; fall back to largest
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url ?? null;
}

export async function fetchUserPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const all: SpotifyPlaylist[] = [];
  let url: string | null = "/me/playlists?limit=50";
  while (url) {
    const res = await spotifyFetch(accessToken, url.startsWith("http") ? url.replace(SPOTIFY_API, "") : url);
    if (!res.ok) throw new Error(`Playlists fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      items: SpotifyPlaylist[];
      next: string | null;
    };
    all.push(...data.items.filter((p) => p && p.id));
    url = data.next ? data.next.replace(SPOTIFY_API, "") : null;
  }
  return all;
}

type PlaylistItemRow = {
  is_local?: boolean;
  // New API uses `item`; older responses used `track`
  item?: SpotifyTrack | null;
  track?: SpotifyTrack | null;
};

function extractTrack(row: PlaylistItemRow): SpotifyTrack | null {
  const t = row.item || row.track;
  if (!t || !t.id) return null;
  if (row.is_local || t.is_local) return null;
  // Episodes have type "episode" — skip for music gallery
  if ((t as { type?: string }).type && (t as { type?: string }).type !== "track") {
    return null;
  }
  return t;
}

/**
 * Spotify only returns playlist items if the authorized user owns the playlist
 * or is a collaborator. Otherwise the API returns 403.
 * Endpoint: GET /playlists/{id}/items (replaces deprecated /tracks)
 */
export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<TrackItem[]> {
  const tracks: TrackItem[] = [];
  // limit max is 50 on the new items endpoint
  let url: string | null =
    `/playlists/${playlistId}/items?limit=50&additional_types=track&fields=next,items(is_local,item(id,uri,name,duration_ms,explicit,type,artists(name),is_local),track(id,uri,name,duration_ms,explicit,type,artists(name),is_local))`;

  while (url) {
    const path = url.startsWith("http") ? url.replace(SPOTIFY_API, "") : url;
    const res = await spotifyFetch(accessToken, path);
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 403) {
        throw new Error(
          `Spotify blocked track list for this playlist (403). You must Connect with the Spotify account that owns it (or is a collaborator). Public playlists owned by someone else cannot have their tracks read via the API anymore. ${body.slice(0, 120)}`,
        );
      }
      throw new Error(`Tracks fetch failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      items: PlaylistItemRow[];
      next: string | null;
    };
    for (const row of data.items || []) {
      const t = extractTrack(row);
      if (!t) continue;
      tracks.push({
        id: t.id!,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name),
        durationMs: t.duration_ms,
        explicit: t.explicit,
      });
    }
    url = data.next ? data.next.replace(SPOTIFY_API, "") : null;
  }
  return tracks;
}

/** Extract Spotify playlist ID from URL, URI, or raw id. */
export function parsePlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // spotify:playlist:ID
  const uri = raw.match(/spotify:playlist:([a-zA-Z0-9]+)/i);
  if (uri?.[1]) return uri[1];

  // https://open.spotify.com/playlist/ID?...
  const url = raw.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/i);
  if (url?.[1]) return url[1];

  // bare id
  if (/^[a-zA-Z0-9]{16,32}$/.test(raw)) return raw;

  return null;
}

export function parsePlaylistIds(text: string): string[] {
  const parts = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const id = parsePlaylistId(p);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export async function fetchPlaylistMeta(
  accessToken: string,
  playlistId: string,
): Promise<PlaylistSummary & { ownerId?: string }> {
  // Prefer items.total (current API); fall back to tracks.total (legacy)
  const res = await spotifyFetch(
    accessToken,
    `/playlists/${playlistId}?fields=id,uri,name,description,images,owner(display_name,id),items.total,tracks.total`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Playlist ${playlistId}: ${res.status} ${text}`);
  }
  const p = (await res.json()) as SpotifyPlaylist & {
    items?: { total?: number };
    tracks?: { total?: number };
  };
  const total = p.items?.total ?? p.tracks?.total ?? 0;
  return {
    id: p.id,
    uri: p.uri,
    name: p.name,
    description: (p.description || "").replace(/<[^>]+>/g, ""),
    imageUrl: pickImage(p.images),
    trackCount: total,
    owner: p.owner?.display_name || p.owner?.id || "?",
    ownerId: p.owner?.id,
    color: null,
  };
}

export async function buildCatalogFromIds(
  accessToken: string,
  playlistIds: string[],
  ownerName: string,
  ownerId: string,
): Promise<{ catalog: import("./types").Catalog; details: PlaylistDetail[] }> {
  const details: PlaylistDetail[] = [];
  const summaries: PlaylistSummary[] = [];
  let totalTracks = 0;
  const errors: string[] = [];

  // Who am I? Used to warn when pasting someone else's playlist
  let meId = ownerId;
  try {
    const me = await getMe(accessToken);
    meId = me.id;
  } catch {
    /* keep ownerId */
  }

  for (const id of playlistIds) {
    try {
      const meta = await fetchPlaylistMeta(accessToken, id);
      if (meta.ownerId && meta.ownerId !== meId) {
        errors.push(
          `"${meta.name}" is owned by ${meta.owner} (id ${meta.ownerId}), but you are logged in as ${meId}. Spotify only allows reading tracks for playlists you own. Re-connect with the owner account, or paste a playlist you created.`,
        );
        continue;
      }
      const tracks = await fetchPlaylistTracks(accessToken, id);
      totalTracks += tracks.length;
      const summary: PlaylistSummary = {
        id: meta.id,
        uri: meta.uri,
        name: meta.name,
        description: meta.description,
        imageUrl: meta.imageUrl,
        trackCount: tracks.length || meta.trackCount,
        owner: meta.owner,
        color: null,
      };
      summaries.push(summary);
      details.push({
        ...summary,
        tracks,
        syncedAt: new Date().toISOString(),
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (!details.length && errors.length) {
    throw new Error(`Could not load any playlists. ${errors[0]}`);
  }

  return {
    catalog: {
      playlists: summaries,
      ownerName,
      ownerId: meId,
      syncedAt: new Date().toISOString(),
      totalTracks,
    },
    details,
  };
}

export async function ensureFreshSession(
  env: Env,
  session: SessionData,
): Promise<{ session: SessionData; rotated: boolean }> {
  if (Date.now() < session.expiresAt - 60_000) {
    return { session, rotated: false };
  }
  const tokens = await refreshAccessToken(env, session.refreshToken);
  const next: SessionData = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  return { session: next, rotated: true };
}

export async function ownerAccessToken(env: Env): Promise<string | null> {
  if (!env.SPOTIFY_OWNER_REFRESH) return null;
  try {
    const tokens = await refreshAccessToken(env, env.SPOTIFY_OWNER_REFRESH);
    return tokens.access_token;
  } catch {
    return null;
  }
}

export async function playOnDevice(
  accessToken: string,
  deviceId: string,
  options: { uris?: string[]; context_uri?: string; offset?: { position?: number; uri?: string } },
): Promise<Response> {
  // Transfer + play
  await spotifyFetch(accessToken, "/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });

  return spotifyFetch(accessToken, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify(options),
  });
}
