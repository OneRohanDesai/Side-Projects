import type { Catalog, Env, PlaylistDetail, PlaylistSummary } from "./types";
import {
  buildCatalogFromIds,
  fetchPlaylistMeta,
  ownerAccessToken,
} from "./spotify";

const CATALOG_KEY = "catalog:v1";
const CURATED_KEY = "curated:v1";
const PLAYLIST_KEY = (id: string) => `playlist:${id}`;

export type CuratedList = {
  playlistIds: string[];
  ownerId?: string;
  ownerName?: string;
  updatedAt: string;
};

export async function getCatalog(env: Env): Promise<Catalog | null> {
  if (!env.CACHE) return null;
  const raw = await env.CACHE.get(CATALOG_KEY, "json");
  return (raw as Catalog) || null;
}

export async function getPlaylistDetail(
  env: Env,
  id: string,
): Promise<PlaylistDetail | null> {
  if (!env.CACHE) return null;
  const raw = await env.CACHE.get(PLAYLIST_KEY(id), "json");
  return (raw as PlaylistDetail) || null;
}

export async function saveCatalog(
  env: Env,
  catalog: Catalog,
  details: PlaylistDetail[],
): Promise<void> {
  if (!env.CACHE) throw new Error("KV CACHE binding missing");
  await env.CACHE.put(CATALOG_KEY, JSON.stringify(catalog));
  await Promise.all(
    details.map((d) => env.CACHE.put(PLAYLIST_KEY(d.id), JSON.stringify(d))),
  );
}

export async function getCurated(env: Env): Promise<CuratedList> {
  if (!env.CACHE) return { playlistIds: [], updatedAt: new Date(0).toISOString() };
  const raw = (await env.CACHE.get(CURATED_KEY, "json")) as CuratedList | null;
  return raw || { playlistIds: [], updatedAt: new Date(0).toISOString() };
}

export async function saveCurated(env: Env, list: CuratedList): Promise<void> {
  if (!env.CACHE) throw new Error("KV CACHE binding missing");
  await env.CACHE.put(CURATED_KEY, JSON.stringify(list));
}

/** Publish only the curated playlist IDs into the public gallery. */
export async function publishCurated(
  env: Env,
  accessToken: string,
  ownerName: string,
  ownerId: string,
  playlistIds?: string[],
): Promise<Catalog> {
  const curated = await getCurated(env);
  const ids = playlistIds ?? curated.playlistIds;
  if (!ids.length) {
    // Empty gallery
    const empty: Catalog = {
      playlists: [],
      ownerName,
      ownerId,
      syncedAt: new Date().toISOString(),
      totalTracks: 0,
    };
    await saveCatalog(env, empty, []);
    await saveCurated(env, {
      playlistIds: [],
      ownerId,
      ownerName,
      updatedAt: new Date().toISOString(),
    });
    return empty;
  }

  const { catalog, details } = await buildCatalogFromIds(
    accessToken,
    ids,
    ownerName,
    ownerId,
  );
  await saveCatalog(env, catalog, details);
  await saveCurated(env, {
    playlistIds: details.map((d) => d.id),
    ownerId,
    ownerName,
    updatedAt: new Date().toISOString(),
  });
  return catalog;
}

export async function previewCuratedMeta(
  accessToken: string,
  ids: string[],
): Promise<PlaylistSummary[]> {
  const out: PlaylistSummary[] = [];
  for (const id of ids) {
    try {
      out.push(await fetchPlaylistMeta(accessToken, id));
    } catch {
      out.push({
        id,
        uri: `spotify:playlist:${id}`,
        name: `Unknown (${id.slice(0, 8)}…)`,
        description: "Could not load this playlist — check the link and visibility.",
        imageUrl: null,
        trackCount: 0,
        owner: "?",
        color: null,
      });
    }
  }
  return out;
}

export async function maybeRefreshStaleCatalog(env: Env): Promise<Catalog | null> {
  const existing = await getCatalog(env);
  const curated = await getCurated(env);
  if (!curated.playlistIds.length) return existing;

  if (!existing) {
    const token = await ownerAccessToken(env);
    if (!token) return null;
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) return null;
    const me = (await meRes.json()) as { id: string; display_name: string };
    return publishCurated(env, token, me.display_name || me.id, me.id);
  }

  const age = Date.now() - new Date(existing.syncedAt).getTime();
  const STALE_MS = 1000 * 60 * 60 * 12;
  if (age < STALE_MS) return existing;

  const token = await ownerAccessToken(env);
  if (!token) return existing;
  try {
    return await publishCurated(
      env,
      token,
      existing.ownerName || curated.ownerName || "Curator",
      existing.ownerId || curated.ownerId || "unknown",
    );
  } catch {
    return existing;
  }
}
