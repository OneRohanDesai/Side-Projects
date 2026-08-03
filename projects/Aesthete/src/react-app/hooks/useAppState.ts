import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loginRedirect } from "../lib/api";
import { extractAtmosphere, DEFAULT_ATMOSPHERE, type Atmosphere } from "../lib/color";
import {
  formatDuration,
  markPlayed,
  pickUnplayed,
  resetSessionPlays,
  storage,
  type JournalEntry,
  type ListeningPrefs,
} from "../lib/storage";
import { resonance } from "../lib/resonance";
import {
  buildArtistThread,
  buildDuologue,
  buildHourglass,
  buildOverture,
  buildPostcardText,
  buildResonanceWeave,
  shuffleInPlace,
} from "../lib/rituals";
import { createPlayer } from "../lib/spotify-player";
import type {
  AuthUser,
  Catalog,
  PlaylistDetail,
  QueueItem,
  SpotifyPlayer,
  SpotifyState,
  TrackItem,
  View,
} from "../types";

export function useAppState() {
  const [auth, setAuth] = useState<{ ready: boolean; user: AuthUser | null }>({
    ready: false,
    user: null,
  });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [roomCache, setRoomCache] = useState<Record<string, PlaylistDetail>>({});
  const [view, setView] = useState<View>({ kind: "gallery" });
  const [atmosphere, setAtmosphere] = useState<Atmosphere>(DEFAULT_ATMOSPHERE);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState<{
    track: TrackItem;
    playlistId: string;
    playlistName: string;
  } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusEndsAt, setFocusEndsAt] = useState<number | null>(null);
  const [weaveIds, setWeaveIds] = useState<string[]>(() => storage.getWeave());
  const [volume, setVolume] = useState(() => storage.getVolume());
  const [journal, setJournal] = useState<JournalEntry[]>(() => storage.getJournal());
  const [bootingPlayer, setBootingPlayer] = useState(false);
  const [prefs, setPrefsState] = useState<ListeningPrefs>(() => storage.getPrefs());
  const [blindfoldRevealed, setBlindfoldRevealed] = useState(false);
  const [silenceUntil, setSilenceUntil] = useState<number | null>(null);
  const [hourglassEndsAt, setHourglassEndsAt] = useState<number | null>(null);
  const [activeRitual, setActiveRitual] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const positionTimer = useRef<number | null>(null);
  const lastTrackId = useRef<string | null>(null);
  /** Ordered tracks for the active play session (from start index to end). */
  const sessionTracksRef = useRef<QueueItem[]>([]);
  const currentRef = useRef<typeof current>(null);
  const prefsRef = useRef(prefs);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const silenceTimerRef = useRef<number | null>(null);
  const listenStartedAt = useRef<number>(Date.now());

  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const updatePrefs = useCallback((patch: Partial<ListeningPrefs>) => {
    const next = storage.setPrefs(patch);
    setPrefsState(next);
    return next;
  }, []);

  /** Sync now-playing + queue from Spotify SDK state. */
  const applyPlayerState = useCallback((state: SpotifyState | null) => {
    if (!state) {
      setPaused(true);
      return;
    }

    setPaused(state.paused);
    setPosition(state.position);
    setDuration(state.duration);

    const t = state.track_window?.current_track;
    if (!t?.id && !t?.uri) return;

    const trackKey = t.id || t.uri;
    const session = sessionTracksRef.current;
    const idx = session.findIndex(
      (x) => (t.id && x.id === t.id) || (t.uri && x.uri === t.uri),
    );

    let nextCurrent: {
      track: TrackItem;
      playlistId: string;
      playlistName: string;
    };

    if (idx >= 0) {
      const found = session[idx]!;
      nextCurrent = {
        track: found,
        playlistId: found.playlistId,
        playlistName: found.playlistName,
      };
      setQueue(session.slice(idx + 1));
    } else {
      const prev = currentRef.current;
      nextCurrent = {
        track: {
          id: t.id || t.uri,
          uri: t.uri,
          name: t.name,
          artists: (t.artists || []).map((a) => a.name),
          durationMs: t.duration_ms || state.duration || 0,
          explicit: false,
        },
        playlistId: prev?.playlistId || "",
        playlistName: prev?.playlistName || "",
      };
      setQueue((q) => {
        const i = q.findIndex(
          (x) => (t.id && x.id === t.id) || (t.uri && x.uri === t.uri),
        );
        if (i >= 0) return q.slice(i + 1);
        if (q[0] && ((t.id && q[0].id === t.id) || q[0].uri === t.uri)) {
          return q.slice(1);
        }
        return q;
      });
    }

    const prevKey = lastTrackId.current;
    const changed = trackKey !== prevKey;
    lastTrackId.current = trackKey;

    setCurrent(nextCurrent);
    currentRef.current = nextCurrent;

    if (changed) {
      // Resonance: previous track complete vs skip
      if (prevKey) {
        const listened = Date.now() - listenStartedAt.current;
        const dur = durationRef.current || 1;
        const ratio = positionRef.current / dur;
        if (ratio >= 0.75 || listened >= dur * 0.75) {
          resonance.recordComplete(prevKey, listened);
        } else if (ratio < 0.35) {
          resonance.recordSkip(prevKey, listened);
        } else {
          resonance.recordDwell(prevKey, listened);
        }
      }
      listenStartedAt.current = Date.now();
      setBlindfoldRevealed(false);

      markPlayed(nextCurrent.track.id);
      storage.pushJournal({
        trackId: nextCurrent.track.id,
        name: nextCurrent.track.name,
        artists: nextCurrent.track.artists,
        playlistName: nextCurrent.playlistName,
      });
      setJournal(storage.getJournal());

      // Between silence — contemplative gap after a track change
      const gap = prefsRef.current.betweenSilence;
      if (gap > 0 && prevKey) {
        void playerRef.current?.pause();
        setSilenceUntil(Date.now() + gap * 1000);
        if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = window.setTimeout(() => {
          setSilenceUntil(null);
          void playerRef.current?.resume();
        }, gap * 1000);
      }
    }

    if (!state.duration && nextCurrent.track.durationMs) {
      setDuration(nextCurrent.track.durationMs);
    }
  }, []);

  // Auth bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setAuth({ ready: true, user: me.authenticated && me.user ? me.user : null });
      } catch {
        if (!cancelled) setAuth({ ready: true, user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catalog bootstrap
  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const c = await api.catalog();
      setCatalog(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  // Deep links
  useEffect(() => {
    const applyPath = () => {
      const path = window.location.pathname;
      if (path.startsWith("/studio")) {
        setView({ kind: "studio" });
        return;
      }
      const roomMatch = path.match(/^\/room\/([a-zA-Z0-9]+)/);
      if (roomMatch?.[1]) {
        setView({ kind: "room", playlistId: roomMatch[1] });
        return;
      }
      setView({ kind: "gallery" });
    };
    applyPath();
    window.addEventListener("popstate", applyPath);
    return () => window.removeEventListener("popstate", applyPath);
  }, []);

  const navigate = useCallback((next: View) => {
    setView(next);
    if (next.kind === "gallery") {
      window.history.pushState({}, "", "/");
    } else if (next.kind === "room") {
      window.history.pushState({}, "", `/room/${next.playlistId}`);
      storage.setLastRoom(next.playlistId);
    } else if (next.kind === "studio") {
      window.history.pushState({}, "", "/studio");
    }
  }, []);

  const loadRoom = useCallback(
    async (playlistId: string) => {
      if (roomCache[playlistId]) return roomCache[playlistId];
      const detail = await api.playlist(playlistId);
      setRoomCache((prev) => ({ ...prev, [playlistId]: detail }));
      return detail;
    },
    [roomCache],
  );

  // Atmosphere from current room or playing playlist
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let image: string | null = null;
      if (view.kind === "room") {
        const p =
          roomCache[view.playlistId] || catalog?.playlists.find((x) => x.id === view.playlistId);
        image = p?.imageUrl ?? null;
      } else if (current) {
        const p = catalog?.playlists.find((x) => x.id === current.playlistId);
        image = p?.imageUrl ?? null;
      } else if (catalog?.playlists[0]) {
        image = catalog.playlists[0].imageUrl;
      }
      const atm = await extractAtmosphere(image);
      if (!cancelled) setAtmosphere(atm);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, current, catalog, roomCache]);

  // Apply CSS vars
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", atmosphere.accent);
    root.style.setProperty("--accent-soft", atmosphere.soft);
    root.style.setProperty("--accent-glow", atmosphere.glow);
    root.style.setProperty("--deep", atmosphere.deep);
  }, [atmosphere]);

  // Position ticker while playing
  useEffect(() => {
    if (positionTimer.current) {
      window.clearInterval(positionTimer.current);
      positionTimer.current = null;
    }
    if (!paused && current) {
      positionTimer.current = window.setInterval(() => {
        setPosition((p) => Math.min(p + 250, duration || p + 250));
      }, 250);
    }
    return () => {
      if (positionTimer.current) window.clearInterval(positionTimer.current);
    };
  }, [paused, current, duration]);

  // Focus timer
  useEffect(() => {
    if (!focusEndsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= focusEndsAt) {
        setFocusEndsAt(null);
        void playerRef.current?.pause();
        showToast("Focus session complete. Take a breath.");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusEndsAt, showToast]);

  // Hourglass end
  useEffect(() => {
    if (!hourglassEndsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= hourglassEndsAt) {
        setHourglassEndsAt(null);
        setActiveRitual(null);
        void playerRef.current?.pause();
        showToast("Hourglass empty. The session ends here.");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [hourglassEndsAt, showToast]);

  // Blindfold auto-reveal at threshold
  useEffect(() => {
    if (!prefs.blindfold || blindfoldRevealed || !current || !duration) return;
    const pct = (position / duration) * 100;
    if (pct >= prefs.blindfoldRevealAt) {
      setBlindfoldRevealed(true);
    }
  }, [prefs.blindfold, prefs.blindfoldRevealAt, blindfoldRevealed, current, position, duration]);

  // Silence countdown clear
  useEffect(() => {
    if (!silenceUntil) return;
    const id = window.setInterval(() => {
      if (Date.now() >= silenceUntil) setSilenceUntil(null);
    }, 200);
    return () => window.clearInterval(id);
  }, [silenceUntil]);

  // Lantern class on body
  useEffect(() => {
    document.documentElement.classList.toggle("lantern", prefs.lantern);
    return () => document.documentElement.classList.remove("lantern");
  }, [prefs.lantern]);

  const ensurePlayer = useCallback(async () => {
    if (playerRef.current) return playerRef.current;
    if (!auth.user) {
      loginRedirect();
      throw new Error("auth");
    }
    if (!auth.user.isPremium) {
      throw new Error("Spotify Premium is required for browser playback.");
    }
    setBootingPlayer(true);
    try {
      const player = await createPlayer(
        {
          onReady: (id) => {
            setDeviceId(id);
            setPlayerReady(true);
          },
          onNotReady: () => {
            setPlayerReady(false);
            setDeviceId(null);
          },
          onState: (state: SpotifyState | null) => {
            applyPlayerState(state);
          },
          onError: (message) => setError(message),
        },
        volume,
      );
      playerRef.current = player;
      // Wait briefly for device id
      await new Promise((r) => setTimeout(r, 600));
      return player;
    } finally {
      setBootingPlayer(false);
    }
  }, [auth.user, volume, applyPlayerState]);

  const deviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  const playTracks = useCallback(
    async (
      tracks: QueueItem[],
      startIndex = 0,
    ) => {
      if (!tracks.length) return;
      setError(null);
      try {
        if (!auth.user) {
          loginRedirect();
          return;
        }
        if (!auth.user.isPremium) {
          setError("Spotify Premium is required for full browser playback.");
          return;
        }
        await ensurePlayer();
        await playerRef.current?.activateElement();

        let id = deviceIdRef.current;
        for (let i = 0; i < 25 && !id; i++) {
          await new Promise((r) => setTimeout(r, 120));
          id = deviceIdRef.current;
        }
        if (!id) {
          setError("Player device not ready yet — try again in a moment.");
          return;
        }

        const session = tracks.slice(startIndex);
        const start = session[0]!;
        const uris = session.map((t) => t.uri);
        // Spotify allows max ~100 uris; keep a sensible batch
        const batch = uris.slice(0, 80);

        sessionTracksRef.current = session;
        lastTrackId.current = start.id;

        await api.play({ device_id: id, uris: batch });
        const now = {
          track: start,
          playlistId: start.playlistId,
          playlistName: start.playlistName,
        };
        setCurrent(now);
        currentRef.current = now;
        setQueue(session.slice(1));
        setPaused(false);
        setPosition(0);
        setDuration(start.durationMs);
        markPlayed(start.id);
        storage.pushJournal({
          trackId: start.id,
          name: start.name,
          artists: start.artists,
          playlistName: start.playlistName,
        });
        setJournal(storage.getJournal());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Playback failed");
      }
    },
    [auth.user, ensurePlayer],
  );

  const playFromPlaylist = useCallback(
    async (playlist: PlaylistDetail, trackIndex = 0) => {
      const items: QueueItem[] = playlist.tracks.map((t) => ({
        ...t,
        playlistId: playlist.id,
        playlistName: playlist.name,
      }));
      await playTracks(items, trackIndex);
    },
    [playTracks],
  );

  const togglePlay = useCallback(async () => {
    if (!playerRef.current) {
      if (current && queue) {
        // re-init
        await ensurePlayer();
      }
      return;
    }
    await playerRef.current.togglePlay();
  }, [current, queue, ensurePlayer]);

  const nextTrack = useCallback(async () => {
    try {
      if (playerRef.current) {
        await playerRef.current.nextTrack();
        // State listener will update now-playing; poll once as a safety net
        window.setTimeout(async () => {
          const st = await playerRef.current?.getCurrentState();
          if (st) applyPlayerState(st);
        }, 250);
        return;
      }
    } catch {
      /* fall through to queue */
    }
    const q = sessionTracksRef.current;
    const curId = currentRef.current?.track.id;
    const idx = q.findIndex((t) => t.id === curId);
    if (idx >= 0 && idx < q.length - 1) {
      await playTracks(q, idx + 1);
    } else if (queue.length) {
      await playTracks(queue, 0);
    }
  }, [queue, playTracks, applyPlayerState]);

  const prevTrack = useCallback(async () => {
    if (position > 3000) {
      await playerRef.current?.seek(0);
      setPosition(0);
      return;
    }
    try {
      await playerRef.current?.previousTrack();
      window.setTimeout(async () => {
        const st = await playerRef.current?.getCurrentState();
        if (st) applyPlayerState(st);
      }, 250);
    } catch {
      const q = sessionTracksRef.current;
      const curId = currentRef.current?.track.id;
      const idx = q.findIndex((t) => t.id === curId);
      if (idx > 0) {
        await playTracks(q, idx - 1);
      }
    }
  }, [position, applyPlayerState, playTracks]);

  const seek = useCallback(async (ms: number) => {
    await playerRef.current?.seek(ms);
    setPosition(ms);
  }, []);

  const changeVolume = useCallback(async (v: number) => {
    setVolume(v);
    storage.setVolume(v);
    await playerRef.current?.setVolume(v);
  }, []);

  const publishGallery = useCallback(
    async (links?: string) => {
      if (!auth.user) {
        loginRedirect();
        return null;
      }
      setSyncing(true);
      setError(null);
      try {
        const result = await api.publish(links);
        setCatalog(result.catalog);
        setRoomCache({});
        showToast(`Published ${result.count} rooms · ${result.totalTracks} tracks`);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Publish failed");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [auth.user, showToast],
  );

  const logout = useCallback(async () => {
    await api.logout();
    playerRef.current?.disconnect();
    playerRef.current = null;
    setAuth({ ready: true, user: null });
    setPlayerReady(false);
    setDeviceId(null);
    setCurrent(null);
    showToast("Disconnected");
  }, [showToast]);

  const startFocus = useCallback((minutes: number) => {
    setFocusMinutes(minutes);
    setFocusEndsAt(Date.now() + minutes * 60 * 1000);
    showToast(`Focus · ${minutes} minutes`);
  }, [showToast]);

  const stopFocus = useCallback(() => setFocusEndsAt(null), []);

  const toggleWeave = useCallback((playlistId: string) => {
    setWeaveIds((prev) => {
      const next = prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId];
      storage.setWeave(next);
      return next;
    });
  }, []);

  const collectTracks = useCallback(
    async (ids?: string[]): Promise<QueueItem[]> => {
      const target =
        ids && ids.length
          ? ids
          : weaveIds.length
            ? weaveIds
            : catalog?.playlists.map((p) => p.id) || [];
      const all: QueueItem[] = [];
      for (const id of target) {
        try {
          const detail = roomCache[id] || (await loadRoom(id));
          for (const t of detail.tracks) {
            all.push({ ...t, playlistId: detail.id, playlistName: detail.name });
          }
        } catch {
          /* skip */
        }
      }
      return all;
    },
    [weaveIds, catalog, roomCache, loadRoom],
  );

  const playWeave = useCallback(async () => {
    const all = await collectTracks();
    if (!all.length) {
      setError("Could not load tracks for weave. Mark rooms with ✦ or publish more playlists.");
      return;
    }
    resetSessionPlays();
    shuffleInPlace(all);
    const first = pickUnplayed(all) || all[0]!;
    const startIndex = all.findIndex((t) => t.id === first.id);
    setActiveRitual("Weave");
    setHourglassEndsAt(null);
    showToast(`Weave · ${all.length} tracks across rooms`);
    await playTracks(all, Math.max(0, startIndex));
  }, [collectTracks, playTracks, showToast]);

  const playHourglass = useCallback(
    async (minutes: number) => {
      const all = await collectTracks();
      if (!all.length) {
        setError("No tracks available for Hourglass.");
        return;
      }
      const packed = buildHourglass(all, minutes);
      if (!packed.length) {
        setError("Hourglass could not pack a session.");
        return;
      }
      resetSessionPlays();
      setActiveRitual(`Hourglass · ${minutes}m`);
      setHourglassEndsAt(Date.now() + minutes * 60 * 1000);
      setFocusEndsAt(null);
      showToast(`Hourglass · ${minutes} minutes · ${packed.length} tracks`);
      await playTracks(packed, 0);
    },
    [collectTracks, playTracks, showToast],
  );

  const playDuologue = useCallback(async () => {
    const ids = weaveIds.length >= 2 ? weaveIds.slice(0, 2) : weaveIds;
    if (ids.length < 2) {
      setError("Duologue needs two rooms marked with ✦.");
      return;
    }
    const [aId, bId] = ids;
    const a = await collectTracks([aId!]);
    const b = await collectTracks([bId!]);
    if (!a.length || !b.length) {
      setError("Could not load both rooms for Duologue.");
      return;
    }
    const mixed = buildDuologue(a, b);
    resetSessionPlays();
    setActiveRitual("Duologue");
    setHourglassEndsAt(null);
    showToast(`Duologue · ${a[0]?.playlistName} ⇄ ${b[0]?.playlistName}`);
    await playTracks(mixed, 0);
  }, [weaveIds, collectTracks, playTracks, showToast]);

  const playArtistThread = useCallback(
    async (artist: string) => {
      const all = await collectTracks(catalog?.playlists.map((p) => p.id));
      const thread = buildArtistThread(all, artist);
      if (!thread.length) {
        setError(`No tracks matching “${artist}” across the gallery.`);
        return;
      }
      resetSessionPlays();
      setActiveRitual(`Thread · ${artist}`);
      setHourglassEndsAt(null);
      showToast(`Thread · ${thread.length} tracks · ${artist}`);
      await playTracks(thread, 0);
    },
    [collectTracks, catalog, playTracks, showToast],
  );

  const playResonanceWeave = useCallback(async () => {
    const all = await collectTracks();
    if (!all.length) {
      setError("No tracks for Resonance.");
      return;
    }
    const ordered = buildResonanceWeave(all);
    resetSessionPlays();
    setActiveRitual("Resonance");
    setHourglassEndsAt(null);
    showToast(`Resonance · shaped by how you actually listen`);
    await playTracks(ordered, 0);
  }, [collectTracks, playTracks, showToast]);

  const playOverture = useCallback(async () => {
    const rooms: { id: string; name: string; tracks: QueueItem[] }[] = [];
    for (const p of catalog?.playlists || []) {
      try {
        const d = roomCache[p.id] || (await loadRoom(p.id));
        rooms.push({
          id: d.id,
          name: d.name,
          tracks: d.tracks.map((t) => ({
            ...t,
            playlistId: d.id,
            playlistName: d.name,
          })),
        });
      } catch {
        /* skip */
      }
    }
    const seq = buildOverture(rooms, 3);
    if (!seq.length) {
      setError("Overture needs at least one published room with tracks.");
      return;
    }
    resetSessionPlays();
    setActiveRitual("Overture");
    setHourglassEndsAt(null);
    showToast("Overture · three rooms, then a deeper dive");
    await playTracks(seq, 0);
  }, [catalog, roomCache, loadRoom, playTracks, showToast]);

  const copyPostcard = useCallback(async () => {
    if (!current) {
      setError("Nothing playing to postcard.");
      return;
    }
    const url = `${window.location.origin}/room/${current.playlistId}`;
    const text = buildPostcardText({
      trackName: current.track.name,
      artists: current.track.artists,
      playlistName: current.playlistName,
      url,
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast("Postcard copied — paste anywhere");
    } catch {
      setError("Could not copy postcard.");
    }
  }, [current, showToast]);

  const revealBlindfold = useCallback(() => setBlindfoldRevealed(true), []);

  // Search index
  const searchIndex = useMemo(() => {
    const items: {
      track: TrackItem;
      playlistId: string;
      playlistName: string;
    }[] = [];
    for (const [pid, detail] of Object.entries(roomCache)) {
      for (const t of detail.tracks) {
        items.push({ track: t, playlistId: pid, playlistName: detail.name });
      }
    }
    // Also index catalog names for playlists
    return items;
  }, [roomCache]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          void togglePlay();
          break;
        case "ArrowRight":
        case "j":
          void nextTrack();
          break;
        case "ArrowLeft":
        case "k":
          void prevTrack();
          break;
        case "/":
          e.preventDefault();
          setPaletteOpen(true);
          break;
        case "f":
        case "F":
          if (current) setView({ kind: "cinema" });
          break;
        case "Escape":
          if (view.kind === "cinema") setView(current ? { kind: "room", playlistId: current.playlistId } : { kind: "gallery" });
          setPaletteOpen(false);
          setQueueOpen(false);
          break;
        case "g":
          navigate({ kind: "gallery" });
          break;
        case "q":
          setQueueOpen((v) => !v);
          break;
        case "b":
        case "B":
          if (prefs.blindfold) setBlindfoldRevealed(true);
          break;
        case "p":
        case "P":
          void copyPostcard();
          break;
        case "l":
        case "L":
          updatePrefs({ lantern: !prefs.lantern });
          showToast(prefs.lantern ? "Lantern off" : "Lantern on");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, nextTrack, prevTrack, current, view, navigate, prefs, copyPostcard, updatePrefs, showToast]);

  // Cleanup player
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
    };
  }, []);

  // Auth query param toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    if (authParam === "ok") {
      showToast("Connected to Spotify");
      window.history.replaceState({}, "", window.location.pathname);
      void api.me().then((me) => {
        setAuth({ ready: true, user: me.authenticated && me.user ? me.user : null });
        if (me.authenticated && window.location.pathname !== "/studio") {
          // Prefer Studio after connect so curator can add links
          window.history.replaceState({}, "", "/studio");
          setView({ kind: "studio" });
        }
      });
      void refreshCatalog();
    } else if (authParam === "error") {
      setError(params.get("reason") || "Authentication failed");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showToast, refreshCatalog]);

  return {
    auth,
    catalog,
    catalogLoading,
    roomCache,
    view,
    navigate,
    loadRoom,
    atmosphere,
    deviceId,
    playerReady,
    bootingPlayer,
    paused,
    position,
    duration,
    current,
    queue,
    error,
    setError,
    toast,
    syncing,
    paletteOpen,
    setPaletteOpen,
    queueOpen,
    setQueueOpen,
    focusMinutes,
    focusEndsAt,
    startFocus,
    stopFocus,
    weaveIds,
    toggleWeave,
    playWeave,
    playHourglass,
    playDuologue,
    playArtistThread,
    playResonanceWeave,
    playOverture,
    copyPostcard,
    volume,
    changeVolume,
    journal,
    playFromPlaylist,
    playTracks,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    publishGallery,
    logout,
    login: loginRedirect,
    searchIndex,
    formatDuration,
    showToast,
    prefs,
    updatePrefs,
    blindfoldRevealed,
    revealBlindfold,
    silenceUntil,
    hourglassEndsAt,
    activeRitual,
    setActiveRitual,
    setHourglassEndsAt,
  };
}

export type AppState = ReturnType<typeof useAppState>;
