import type { QueueItem } from "../types";

const KEYS = {
  lastRoom: "aesthete:lastRoom",
  volume: "aesthete:volume",
  journal: "aesthete:journal",
  weaveIds: "aesthete:weave",
  prefs: "aesthete:prefs:v1",
} as const;

export type ListeningPrefs = {
  /** Contemplative silence between tracks (seconds). 0 = off */
  betweenSilence: number;
  /** Hide titles until reveal / threshold */
  blindfold: boolean;
  /** % of track before auto-reveal when blindfold on */
  blindfoldRevealAt: number;
  /** Extreme night minimal chrome */
  lantern: boolean;
};

const DEFAULT_PREFS: ListeningPrefs = {
  betweenSilence: 0,
  blindfold: false,
  blindfoldRevealAt: 40,
  lantern: false,
};

export type JournalEntry = {
  trackId: string;
  name: string;
  artists: string[];
  playlistName: string;
  at: number;
};

export const storage = {
  getLastRoom(): string | null {
    return localStorage.getItem(KEYS.lastRoom);
  },
  setLastRoom(id: string) {
    localStorage.setItem(KEYS.lastRoom, id);
  },
  getVolume(): number {
    const v = localStorage.getItem(KEYS.volume);
    return v ? Math.min(1, Math.max(0, Number(v))) : 0.7;
  },
  setVolume(v: number) {
    localStorage.setItem(KEYS.volume, String(v));
  },
  getJournal(): JournalEntry[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.journal) || "[]") as JournalEntry[];
    } catch {
      return [];
    }
  },
  pushJournal(entry: Omit<JournalEntry, "at">) {
    const list = storage.getJournal().filter((e) => e.trackId !== entry.trackId);
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(KEYS.journal, JSON.stringify(list.slice(0, 80)));
  },
  getWeave(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEYS.weaveIds) || "[]") as string[];
    } catch {
      return [];
    }
  },
  setWeave(ids: string[]) {
    localStorage.setItem(KEYS.weaveIds, JSON.stringify(ids));
  },
  getPrefs(): ListeningPrefs {
    try {
      return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEYS.prefs) || "{}") as Partial<ListeningPrefs>) };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  },
  setPrefs(patch: Partial<ListeningPrefs>) {
    const next = { ...storage.getPrefs(), ...patch };
    localStorage.setItem(KEYS.prefs, JSON.stringify(next));
    return next;
  },
};

/** Session-scoped never-repeat set for weave/shuffle. */
const playedThisSession = new Set<string>();

export function markPlayed(id: string) {
  playedThisSession.add(id);
}

export function wasPlayed(id: string) {
  return playedThisSession.has(id);
}

export function resetSessionPlays() {
  playedThisSession.clear();
}

export function pickUnplayed(items: QueueItem[]): QueueItem | null {
  const fresh = items.filter((t) => !playedThisSession.has(t.id));
  const pool = fresh.length ? fresh : items;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(ms: number): string {
  return formatDuration(ms);
}
