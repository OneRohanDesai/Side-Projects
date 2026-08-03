/**
 * Local-only listening affinity — never leaves the browser.
 * Completes raise a track; early skips lower it; long dwell soft-boosts.
 */

export type ResonanceEntry = {
  trackId: string;
  completes: number;
  skips: number;
  dwellMs: number;
  lastAt: number;
};

const KEY = "aesthete:resonance:v1";

function load(): Record<string, ResonanceEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, ResonanceEntry>;
  } catch {
    return {};
  }
}

function save(map: Record<string, ResonanceEntry>) {
  // Cap size
  const entries = Object.values(map).sort((a, b) => b.lastAt - a.lastAt).slice(0, 400);
  const next: Record<string, ResonanceEntry> = {};
  for (const e of entries) next[e.trackId] = e;
  localStorage.setItem(KEY, JSON.stringify(next));
}

function bump(trackId: string, patch: Partial<ResonanceEntry>) {
  const map = load();
  const cur = map[trackId] || {
    trackId,
    completes: 0,
    skips: 0,
    dwellMs: 0,
    lastAt: 0,
  };
  map[trackId] = {
    ...cur,
    ...patch,
    trackId,
    completes: (patch.completes !== undefined ? patch.completes : cur.completes),
    skips: (patch.skips !== undefined ? patch.skips : cur.skips),
    dwellMs: (patch.dwellMs !== undefined ? patch.dwellMs : cur.dwellMs),
    lastAt: Date.now(),
  };
  save(map);
}

export const resonance = {
  score(trackId: string): number {
    const e = load()[trackId];
    if (!e) return 0;
    const dwell = Math.min(e.dwellMs / 60_000, 12);
    return e.completes * 4 - e.skips * 3 + dwell;
  },
  recordComplete(trackId: string, listenedMs: number) {
    const map = load();
    const cur = map[trackId];
    bump(trackId, {
      completes: (cur?.completes || 0) + 1,
      dwellMs: (cur?.dwellMs || 0) + listenedMs,
    });
  },
  recordSkip(trackId: string, listenedMs: number) {
    const map = load();
    const cur = map[trackId];
    bump(trackId, {
      skips: (cur?.skips || 0) + 1,
      dwellMs: (cur?.dwellMs || 0) + listenedMs,
    });
  },
  recordDwell(trackId: string, ms: number) {
    if (ms < 5_000) return;
    const map = load();
    const cur = map[trackId];
    bump(trackId, { dwellMs: (cur?.dwellMs || 0) + ms });
  },
  all(): ResonanceEntry[] {
    return Object.values(load()).sort((a, b) => resonance.score(b.trackId) - resonance.score(a.trackId));
  },
  /** Weighted shuffle: higher resonance more likely earlier. */
  sortByResonance<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const sa = resonance.score(a.id) + Math.random() * 2;
      const sb = resonance.score(b.id) + Math.random() * 2;
      return sb - sa;
    });
  },
};
