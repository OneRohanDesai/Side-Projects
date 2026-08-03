import type { QueueItem } from "../types";
import { resonance } from "./resonance";

export function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Pack tracks into a listening window (hourglass). Soft overshoot by one track. */
export function buildHourglass(tracks: QueueItem[], minutes: number): QueueItem[] {
  if (!tracks.length || minutes <= 0) return [];
  const budget = minutes * 60_000;
  const pool = shuffleInPlace([...tracks]);
  const out: QueueItem[] = [];
  let used = 0;
  for (const t of pool) {
    if (used >= budget && out.length) break;
    out.push(t);
    used += t.durationMs || 180_000;
    if (out.length >= 80) break;
  }
  return out;
}

/** Alternate tracks from two room pools (duologue). */
export function buildDuologue(a: QueueItem[], b: QueueItem[]): QueueItem[] {
  const A = shuffleInPlace([...a]);
  const B = shuffleInPlace([...b]);
  const out: QueueItem[] = [];
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i]) out.push(A[i]!);
    if (B[i]) out.push(B[i]!);
  }
  return out;
}

/** Follow one artist across rooms as a continuous path. */
export function buildArtistThread(tracks: QueueItem[], artistQuery: string): QueueItem[] {
  const q = artistQuery.trim().toLowerCase();
  if (!q) return [];
  const hits = tracks.filter((t) =>
    t.artists.some((a) => a.toLowerCase().includes(q)),
  );
  // Group by room order, shuffle within room for variety
  const byRoom = new Map<string, QueueItem[]>();
  for (const t of hits) {
    const list = byRoom.get(t.playlistId) || [];
    list.push(t);
    byRoom.set(t.playlistId, list);
  }
  const rooms = [...byRoom.keys()];
  shuffleInPlace(rooms);
  const out: QueueItem[] = [];
  for (const rid of rooms) {
    const list = byRoom.get(rid)!;
    shuffleInPlace(list);
    out.push(...list);
  }
  return out;
}

/** Opening ceremony: one track from each of N rooms, then rest of a random room. */
export function buildOverture(
  rooms: { id: string; name: string; tracks: QueueItem[] }[],
  roomCount = 3,
): QueueItem[] {
  if (!rooms.length) return [];
  const shuffled = shuffleInPlace([...rooms]).filter((r) => r.tracks.length);
  const pick = shuffled.slice(0, Math.min(roomCount, shuffled.length));
  const overture: QueueItem[] = [];
  for (const r of pick) {
    const t = r.tracks[Math.floor(Math.random() * r.tracks.length)]!;
    overture.push(t);
  }
  // Continue with a deeper dive into the last room
  const last = pick[pick.length - 1];
  if (last) {
    const rest = shuffleInPlace(
      last.tracks.filter((t) => !overture.some((o) => o.id === t.id)),
    );
    overture.push(...rest.slice(0, 20));
  }
  return overture;
}

export function buildResonanceWeave(tracks: QueueItem[]): QueueItem[] {
  return resonance.sortByResonance(tracks);
}

export function buildPostcardText(opts: {
  trackName: string;
  artists: string[];
  playlistName: string;
  url: string;
}): string {
  const line = opts.artists.join(" · ");
  return [
    "◇ Aesthete",
    "",
    `“${opts.trackName}”`,
    line,
    opts.playlistName ? `from ${opts.playlistName}` : "",
    "",
    opts.url,
  ]
    .filter(Boolean)
    .join("\n");
}
