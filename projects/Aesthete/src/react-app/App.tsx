import { useEffect, useMemo, useState } from "react";
import { useAppState } from "./hooks/useAppState";
import {
  IconClose,
  IconExpand,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconSearch,
} from "./components/Icons";
import { api } from "./lib/api";
import { formatDuration } from "./lib/storage";
import type { PlaylistDetail, PlaylistSummary, QueueItem } from "./types";

export default function App() {
  const s = useAppState();

  const hideIdentity = s.prefs.blindfold && !s.blindfoldRevealed && Boolean(s.current);

  return (
    <div className={`app ${s.prefs.lantern ? "app--lantern" : ""} ${hideIdentity ? "app--blindfold" : ""}`}>
      <div className="atmosphere" aria-hidden>
        <div className="atmosphere__glow" />
        <div className="atmosphere__grain" />
      </div>

      {s.silenceUntil && (
        <div className="silence-veil" role="status">
          <span>Between</span>
          <em>{Math.max(0, Math.ceil((s.silenceUntil - Date.now()) / 1000))}s</em>
        </div>
      )}

      <div className="shell">
        {s.view.kind !== "cinema" && (
          <header className="topbar">
            <button className="brand" onClick={() => s.navigate({ kind: "gallery" })} type="button">
              <span className="brand__mark">Aesthete</span>
              <span className="brand__tag">Listening gallery</span>
            </button>

            <div className="topbar__actions">
              {s.activeRitual && (
                <span className="focus-pill focus-pill--ritual">{s.activeRitual}</span>
              )}
              {s.focusEndsAt && (
                <span className="focus-pill">
                  Focus · {Math.max(0, Math.ceil((s.focusEndsAt - Date.now()) / 60000))}m
                  <button type="button" className="btn btn--sm btn--ghost" onClick={s.stopFocus}>
                    End
                  </button>
                </span>
              )}
              {s.hourglassEndsAt && (
                <span className="focus-pill">
                  Hourglass · {Math.max(0, Math.ceil((s.hourglassEndsAt - Date.now()) / 60000))}m
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      s.setHourglassEndsAt(null);
                      s.setActiveRitual(null);
                    }}
                  >
                    End
                  </button>
                </span>
              )}
              {s.prefs.blindfold && (
                <span className="focus-pill">
                  Blindfold
                  {!s.blindfoldRevealed && s.current && (
                    <button type="button" className="btn btn--sm btn--ghost" onClick={s.revealBlindfold}>
                      Reveal (B)
                    </button>
                  )}
                </span>
              )}

              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => s.setPaletteOpen(true)}
                title="Search (⌘K)"
              >
                <IconSearch />
                <span>Search</span>
                <span className="kbd">⌘K</span>
              </button>

              <button type="button" className="btn btn--ghost" onClick={() => s.setQueueOpen(true)}>
                Rituals
              </button>

              {s.weaveIds.length > 0 && (
                <button type="button" className="btn btn--accent btn--sm" onClick={() => void s.playWeave()}>
                  Weave {s.weaveIds.length}
                </button>
              )}

              {s.auth.user ? (
                <>
                  <button
                    type="button"
                    className={`btn btn--sm ${s.view.kind === "studio" ? "btn--accent" : ""}`}
                    onClick={() => s.navigate({ kind: "studio" })}
                  >
                    Studio
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => void s.logout()}>
                    {s.auth.user.displayName}
                  </button>
                </>
              ) : (
                <a className="btn btn--primary" href="/api/auth/login">
                  Connect Spotify
                </a>
              )}
            </div>
          </header>
        )}

        <main className={`main ${s.view.kind === "cinema" ? "main--cinema" : ""}`}>
          {s.view.kind === "gallery" && <Gallery s={s} />}
          {s.view.kind === "room" && <Room s={s} playlistId={s.view.playlistId} />}
          {s.view.kind === "cinema" && <Cinema s={s} />}
          {s.view.kind === "studio" && <Studio s={s} />}
        </main>

        <PlayerBar s={s} hideIdentity={hideIdentity} />
      </div>

      {s.paletteOpen && <CommandPalette s={s} />}
      {s.queueOpen && <RitualsDrawer s={s} />}

      {s.toast && <div className="toast">{s.toast}</div>}
      {s.error && (
        <div className="banner-error" role="alert">
          <span>{s.error}</span>
          <button type="button" onClick={() => s.setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

type S = ReturnType<typeof useAppState>;

function Gallery({ s }: { s: S }) {
  if (s.catalogLoading) return <div className="loader" aria-label="Loading" />;

  if (!s.catalog || s.catalog.empty || !s.catalog.playlists.length) {
    return (
      <div className="state-block">
        <h2>Your gallery is waiting</h2>
        <p>
          Connect Spotify, open <strong>Studio</strong>, paste links to the playlists you want shown,
          then publish. Visitors browse freely — Premium unlocks browser playback.
        </p>
        {s.auth.user ? (
          <button type="button" className="btn btn--primary" onClick={() => s.navigate({ kind: "studio" })}>
            Open Studio
          </button>
        ) : (
          <a className="btn btn--primary" href="/api/auth/login">
            Connect Spotify
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="gallery-intro">
        <h1>Rooms of sound, curated with intent.</h1>
        <p>
          Not another music app — a private gallery of {s.catalog.ownerName || "curated"} playlists,
          presented with the quiet luxury they deserve.
        </p>
        <div className="gallery-meta">
          <span>{s.catalog.playlists.length} rooms</span>
          {s.catalog.totalTracks != null && <span>{s.catalog.totalTracks} tracks</span>}
          {s.catalog.syncedAt && (
            <span>Synced {new Date(s.catalog.syncedAt).toLocaleDateString()}</span>
          )}
        </div>
      </section>

      <div className="gallery-rail" role="list">
        {s.catalog.playlists.map((p) => (
          <div key={p.id} className="room-card" role="listitem">
            <button
              type="button"
              className={`room-card__weave ${s.weaveIds.includes(p.id) ? "is-on" : ""}`}
              title={s.weaveIds.includes(p.id) ? "Remove from weave" : "Add to weave"}
              onClick={(e) => {
                e.stopPropagation();
                s.toggleWeave(p.id);
              }}
            >
              ✦
            </button>
            <button
              type="button"
              style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
              onClick={() => s.navigate({ kind: "room", playlistId: p.id })}
            >
              {p.imageUrl ? (
                <img className="room-card__image" src={p.imageUrl} alt="" loading="lazy" />
              ) : (
                <div className="room-card__image room-card__image--empty">◇</div>
              )}
              <div className="room-card__body">
                <div className="room-card__name">{p.name}</div>
                {p.description && <div className="room-card__desc">{p.description}</div>}
                <div className="room-card__meta">
                  <span>{p.trackCount} tracks</span>
                  <span>Enter →</span>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Room({ s, playlistId }: { s: S; playlistId: string }) {
  const [detail, setDetail] = useState<PlaylistDetail | null>(s.roomCache[playlistId] || null);
  const [loading, setLoading] = useState(!s.roomCache[playlistId]);

  useEffect(() => {
    let cancelled = false;
    if (s.roomCache[playlistId]) {
      setDetail(s.roomCache[playlistId]!);
      setLoading(false);
      return;
    }
    setLoading(true);
    s.loadRoom(playlistId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: Error) => s.setError(e.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId, s]);

  if (loading) return <div className="loader" />;
  if (!detail) {
    return (
      <div className="state-block">
        <h2>Room not found</h2>
        <p>This playlist isn’t in the catalog. Sync the library and try again.</p>
        <button type="button" className="btn" onClick={() => s.navigate({ kind: "gallery" })}>
          Back to gallery
        </button>
      </div>
    );
  }

  const isActivePlaylist = s.current?.playlistId === detail.id;

  return (
    <div className="room">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => s.navigate({ kind: "gallery" })}>
        ← Gallery
      </button>

      <header className="room__header" style={{ marginTop: 16 }}>
        {detail.imageUrl ? (
          <img className="room__cover" src={detail.imageUrl} alt="" />
        ) : (
          <div className="room__cover room__cover--empty">◇</div>
        )}
        <div>
          <h1 className="room__title">{detail.name}</h1>
          {detail.description && <p className="room__desc">{detail.description}</p>}
          <div className="room__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void s.playFromPlaylist(detail, 0)}
              disabled={s.bootingPlayer}
            >
              {s.bootingPlayer ? "Starting…" : "Play room"}
            </button>
            <button
              type="button"
              className={`btn ${s.weaveIds.includes(detail.id) ? "btn--accent" : ""}`}
              onClick={() => s.toggleWeave(detail.id)}
            >
              {s.weaveIds.includes(detail.id) ? "In weave ✦" : "Add to weave"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                s.showToast("Room link copied");
              }}
            >
              Share room
            </button>
          </div>
        </div>
      </header>

      <div className="tracklist">
        {detail.tracks.map((t, i) => {
          const active = isActivePlaylist && s.current?.track.id === t.id;
          return (
            <button
              key={`${t.id}-${i}`}
              type="button"
              className={`track ${active ? "is-active" : ""}`}
              onClick={() => void s.playFromPlaylist(detail, i)}
            >
              <span className="track__num">{active && !s.paused ? "♪" : i + 1}</span>
              <span>
                <div className="track__name">{t.name}</div>
                <div className="track__artists">{t.artists.join(", ")}</div>
              </span>
              <span className="track__dur">{formatDuration(t.durationMs)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Studio({ s }: { s: S }) {
  const [links, setLinks] = useState("");
  const [curated, setCurated] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    if (!s.auth.user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.curated();
      setCurated(data.playlists || []);
    } catch (e) {
      s.setError(e instanceof Error ? e.message : "Failed to load studio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.auth.user?.id]);

  if (!s.auth.ready) return <div className="loader" />;

  if (!s.auth.user) {
    return (
      <div className="state-block">
        <h2>Studio</h2>
        <p>Connect the Spotify account that owns your public playlists to curate the gallery.</p>
        <a className="btn btn--primary" href="/api/auth/login">
          Connect Spotify
        </a>
      </div>
    );
  }

  const onSavePreview = async () => {
    if (!links.trim() && !curated.length) {
      s.setError("Paste at least one Spotify playlist link.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      if (links.trim()) {
        const data = await api.saveCurated(links);
        setCurated(data.playlists || []);
        setStatus(`Saved ${data.playlistIds.length} playlist(s). Publish to put them on the public gallery.`);
        setLinks("");
      }
    } catch (e) {
      s.setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onAdd = async () => {
    if (!links.trim()) return;
    setBusy(true);
    try {
      const data = await api.addCurated(links);
      setCurated(data.playlists || []);
      setLinks("");
      setStatus(`Added to collection (${data.playlistIds.length} total).`);
    } catch (e) {
      s.setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (id: string) => {
    setBusy(true);
    try {
      await api.removeCurated(id);
      setCurated((prev) => prev.filter((p) => p.id !== id));
      setStatus("Removed from collection (not published until you hit Publish).");
    } catch (e) {
      s.setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    setBusy(true);
    setStatus(null);
    try {
      // If textarea has links, use those; else publish current curated list
      const result = await s.publishGallery(links.trim() || undefined);
      if (result) {
        setStatus(`Live: ${result.count} rooms · ${result.totalTracks} tracks`);
        setLinks("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => s.navigate({ kind: "gallery" })}>
        ← Gallery
      </button>

      <header className="studio__header">
        <h1>Studio</h1>
        <p>
          Paste Spotify playlist links you <strong>created</strong> on the account you connected
          (Spotify only lets us read tracks for playlists you own). One link per line. Make them
          public if visitors should open them on Spotify.
        </p>
      </header>

      <label className="studio__label" htmlFor="playlist-links">
        Playlist links
      </label>
      <textarea
        id="playlist-links"
        className="studio__textarea"
        rows={6}
        placeholder={`https://open.spotify.com/playlist/…\nhttps://open.spotify.com/playlist/…\nspotify:playlist:…`}
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        disabled={busy}
      />

      <div className="studio__actions">
        {curated.length > 0 ? (
          <button type="button" className="btn" onClick={() => void onAdd()} disabled={busy || !links.trim()}>
            Add links
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => void onSavePreview()} disabled={busy || !links.trim()}>
            Preview collection
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onPublish()}
          disabled={busy || s.syncing || (!links.trim() && !curated.length)}
        >
          {busy || s.syncing ? "Publishing…" : "Publish to gallery"}
        </button>
      </div>

      {status && <p className="studio__status">{status}</p>}

      <section className="studio__list">
        <div className="drawer__label">Collection</div>
        {loading && <div className="loader" />}
        {!loading && !curated.length && (
          <p className="studio__empty">No playlists yet. Paste links above and publish.</p>
        )}
        {curated.map((p) => (
          <div key={p.id} className="studio__row">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" className="studio__thumb" />
            ) : (
              <div className="studio__thumb studio__thumb--empty">◇</div>
            )}
            <div className="studio__row-body">
              <div className="studio__row-name">{p.name}</div>
              <div className="studio__row-meta">
                {p.trackCount} tracks · {p.owner}
              </div>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void onRemove(p.id)}
              disabled={busy}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <p className="studio__hint">
        Connected as <strong>{s.auth.user.displayName}</strong>
        {s.auth.user.isPremium ? " · Premium" : " · Free (browse only; Premium needed to play in browser)"}
      </p>
    </div>
  );
}

function Cinema({ s }: { s: S }) {
  if (!s.current) {
    return (
      <div className="cinema">
        <p className="cinema__label">Cinema</p>
        <h1 className="cinema__title">Nothing playing</h1>
        <button type="button" className="btn" onClick={() => s.navigate({ kind: "gallery" })}>
          Leave cinema
        </button>
      </div>
    );
  }

  const pct = s.duration ? (s.position / s.duration) * 100 : 0;
  const hide = s.prefs.blindfold && !s.blindfoldRevealed;

  return (
    <div className="cinema">
      <p className="cinema__label">{hide ? "········" : s.current.playlistName}</p>
      <h1 className="cinema__title">{hide ? "Listening" : s.current.track.name}</h1>
      <p className="cinema__artists">
        {hide ? "Blindfold · press B to reveal" : s.current.track.artists.join(" · ")}
      </p>
      <div className="cinema__ring">
        <div className="cinema__ring-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="cinema__hint">Esc exit · B reveal · P postcard · L lantern</p>
    </div>
  );
}

function PlayerBar({ s, hideIdentity }: { s: S; hideIdentity?: boolean }) {
  const pct = s.duration ? Math.min(100, (s.position / s.duration) * 100) : 0;

  const onSeek = (e: { currentTarget: HTMLDivElement; clientX: number }) => {
    if (!s.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    void s.seek(Math.floor(ratio * s.duration));
  };

  return (
    <div className="player" role="region" aria-label="Player">
      <div className="player__progress" onClick={onSeek} role="slider" aria-valuenow={pct} tabIndex={0}>
        <div className="player__progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="player__now">
        {s.current ? (
          <>
            <div className="player__title">
              {hideIdentity ? "········" : s.current.track.name}
            </div>
            <div className="player__sub">
              {hideIdentity
                ? "Blindfold listening"
                : (
                  <>
                    {s.current.track.artists.join(", ")}
                    <span style={{ opacity: 0.5 }}> · {s.current.playlistName}</span>
                  </>
                )}
            </div>
          </>
        ) : (
          <>
            <div className="player__title">Aesthete</div>
            <div className="player__sub">
              {s.auth.user?.isPremium
                ? s.playerReady
                  ? "Ready · pick a room"
                  : s.bootingPlayer
                    ? "Warming up the player…"
                    : "Premium connected"
                : s.auth.user
                  ? "Premium required for browser playback"
                  : "Connect Spotify to listen in-browser"}
            </div>
          </>
        )}
      </div>

      <div className="player__controls">
        <button type="button" className="icon-btn" onClick={() => void s.prevTrack()} aria-label="Previous">
          <IconPrev />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--play"
          onClick={() => void s.togglePlay()}
          aria-label={s.paused ? "Play" : "Pause"}
        >
          {s.paused ? <IconPlay size={20} /> : <IconPause size={20} />}
        </button>
        <button type="button" className="icon-btn" onClick={() => void s.nextTrack()} aria-label="Next">
          <IconNext />
        </button>
      </div>

      <div className="player__right">
        <span className="player__time">
          {formatDuration(s.position)} / {formatDuration(s.duration || s.current?.track.durationMs || 0)}
        </span>
        <label className="volume">
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={s.volume}
            onChange={(e) => void s.changeVolume(Number(e.target.value))}
          />
        </label>
        {s.current && (
          <button
            type="button"
            className="icon-btn"
            title="Postcard (P)"
            onClick={() => void s.copyPostcard()}
          >
            ✉
          </button>
        )}
        {s.current && (
          <button
            type="button"
            className="icon-btn"
            title="Cinema mode (F)"
            onClick={() => s.navigate(s.view.kind === "cinema" ? { kind: "room", playlistId: s.current!.playlistId } : { kind: "cinema" })}
          >
            <IconExpand />
          </button>
        )}
      </div>
    </div>
  );
}

function CommandPalette({ s }: { s: S }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [loadingAll, setLoadingAll] = useState(false);

  // Prefetch playlist tracks once when palette opens
  useEffect(() => {
    const playlists = s.catalog?.playlists ?? [];
    if (!playlists.length) return;
    let cancelled = false;
    (async () => {
      setLoadingAll(true);
      try {
        await Promise.all(
          playlists.map(async (p) => {
            try {
              await s.loadRoom(p.id);
            } catch {
              /* skip */
            }
          }),
        );
      } finally {
        if (!cancelled) setLoadingAll(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps -- palette mount
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const items: { track: QueueItem; label: string }[] = [];
    for (const [pid, detail] of Object.entries(s.roomCache)) {
      for (const t of detail.tracks) {
        const hay = `${t.name} ${t.artists.join(" ")} ${detail.name}`.toLowerCase();
        if (!query || hay.includes(query)) {
          items.push({
            track: { ...t, playlistId: pid, playlistName: detail.name },
            label: detail.name,
          });
        }
      }
    }
    return items.slice(0, 40);
  }, [q, s.roomCache]);

  useEffect(() => setActive(0), [q]);

  const playIndex = (i: number) => {
    const item = results[i];
    if (!item) return;
    s.setPaletteOpen(false);
    void s.playTracks([item.track, ...results.slice(i + 1).map((r) => r.track)], 0);
    s.navigate({ kind: "room", playlistId: item.track.playlistId });
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) s.setPaletteOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-label="Search">
        <input
          className="palette__input"
          autoFocus
          placeholder={loadingAll ? "Indexing rooms…" : "Search songs, artists, rooms…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") s.setPaletteOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              playIndex(active);
            }
          }}
        />
        <div className="palette__list">
          {!results.length && (
            <div className="palette__empty">
              {loadingAll ? "Loading tracks…" : q ? "No matches" : "Type to search the gallery"}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.track.id}-${i}`}
              type="button"
              className={`palette__item ${i === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => playIndex(i)}
            >
              <span className="palette__item-name">{r.track.name}</span>
              <span className="palette__item-meta">
                {r.track.artists.join(", ")} · {r.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RitualsDrawer({ s }: { s: S }) {
  const [threadArtist, setThreadArtist] = useState("");

  return (
    <div
      className="overlay"
      style={{ placeItems: "stretch end", paddingTop: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) s.setQueueOpen(false);
      }}
    >
      <aside className="drawer drawer--wide">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Rituals</h2>
          <button type="button" className="icon-btn" onClick={() => s.setQueueOpen(false)} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Overture</div>
          <p className="drawer__desc">
            Opening ceremony — one song from three different rooms, then a deeper dive.
          </p>
          <button type="button" className="btn btn--accent" onClick={() => void s.playOverture()}>
            Begin overture
          </button>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Hourglass</div>
          <p className="drawer__desc">
            Packs a session that fits a time budget, then soft silence when sand runs out. Not a timer
            on top of chaos — a designed arc.
          </p>
          <div className="focus-row">
            {[20, 45, 90, 120].map((m) => (
              <button key={m} type="button" className="btn btn--sm" onClick={() => void s.playHourglass(m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Weave family</div>
          <p className="drawer__desc">
            Mark rooms with ✦ on gallery cards. Weave shuffles; Duologue alternates two rooms;
            Resonance reorders by how you actually listen (local only).
          </p>
          <div className="focus-row">
            <button type="button" className="btn btn--sm btn--accent" onClick={() => void s.playWeave()}>
              {s.weaveIds.length ? `Weave ${s.weaveIds.length}` : "Weave all"}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => void s.playDuologue()}>
              Duologue
            </button>
            <button type="button" className="btn btn--sm" onClick={() => void s.playResonanceWeave()}>
              Resonance
            </button>
          </div>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Artist thread</div>
          <p className="drawer__desc">
            One name, every room — a continuous path through the gallery following a single artist.
          </p>
          <div className="thread-row">
            <input
              className="thread-input"
              placeholder="Artist name…"
              value={threadArtist}
              onChange={(e) => setThreadArtist(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && threadArtist.trim()) void s.playArtistThread(threadArtist.trim());
              }}
            />
            <button
              type="button"
              className="btn btn--sm"
              disabled={!threadArtist.trim()}
              onClick={() => void s.playArtistThread(threadArtist.trim())}
            >
              Thread
            </button>
          </div>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Between · Blindfold · Lantern</div>
          <p className="drawer__desc">
            Contemplative silence between tracks. Blindfold hides names until you reveal (or reach
            the threshold). Lantern dims the chrome for night listening.
          </p>
          <div className="focus-row">
            {[0, 3, 8, 15].map((sec) => (
              <button
                key={sec}
                type="button"
                className={`btn btn--sm ${s.prefs.betweenSilence === sec ? "btn--accent" : ""}`}
                onClick={() => {
                  s.updatePrefs({ betweenSilence: sec });
                  s.showToast(sec ? `Between · ${sec}s silence` : "Between off");
                }}
              >
                {sec === 0 ? "No gap" : `${sec}s`}
              </button>
            ))}
          </div>
          <div className="focus-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`btn btn--sm ${s.prefs.blindfold ? "btn--accent" : ""}`}
              onClick={() => {
                const on = !s.prefs.blindfold;
                s.updatePrefs({ blindfold: on });
                if (!on) s.revealBlindfold();
                s.showToast(on ? "Blindfold on" : "Blindfold off");
              }}
            >
              Blindfold {s.prefs.blindfold ? "on" : "off"}
            </button>
            <button
              type="button"
              className={`btn btn--sm ${s.prefs.lantern ? "btn--accent" : ""}`}
              onClick={() => {
                s.updatePrefs({ lantern: !s.prefs.lantern });
                s.showToast(s.prefs.lantern ? "Lantern off" : "Lantern on");
              }}
            >
              Lantern
            </button>
            <button type="button" className="btn btn--sm" onClick={() => void s.copyPostcard()} disabled={!s.current}>
              Postcard
            </button>
          </div>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Focus (timer only)</div>
          <div className="focus-row">
            {[15, 25, 45, 60].map((m) => (
              <button key={m} type="button" className="btn btn--sm" onClick={() => s.startFocus(m)}>
                {m}m
              </button>
            ))}
            {s.focusEndsAt && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={s.stopFocus}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Up next</div>
          {!s.queue.length && (
            <p className="drawer__empty">Queue is empty</p>
          )}
          {s.queue.slice(0, 10).map((t, i) => (
            <div key={`${t.id}-${i}`} className="journal-item">
              <div className="journal-item__name">
                {s.prefs.blindfold && !s.blindfoldRevealed ? "········" : t.name}
              </div>
              <div className="journal-item__meta">
                {s.prefs.blindfold && !s.blindfoldRevealed
                  ? t.playlistName
                  : `${t.artists.join(", ")} · ${t.playlistName}`}
              </div>
            </div>
          ))}
        </div>

        <div className="drawer__section" style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <div className="drawer__label">Listening journal</div>
          {!s.journal.length && (
            <p className="drawer__empty">Private, local only — tracks you play appear here.</p>
          )}
          {s.journal.slice(0, 16).map((j) => (
            <div key={`${j.trackId}-${j.at}`} className="journal-item">
              <div className="journal-item__name">{j.name}</div>
              <div className="journal-item__meta">
                {j.artists.join(", ")} · {j.playlistName}
              </div>
            </div>
          ))}
        </div>

        <div className="drawer__section">
          <div className="drawer__label">Keys</div>
          <p className="drawer__keys">
            <span className="kbd">Space</span> play · <span className="kbd">←→</span> skip ·{" "}
            <span className="kbd">B</span> reveal · <span className="kbd">P</span> postcard ·{" "}
            <span className="kbd">L</span> lantern · <span className="kbd">F</span> cinema ·{" "}
            <span className="kbd">Q</span> rituals
          </p>
        </div>
      </aside>
    </div>
  );
}
