# AESTHETE — Retro Music Explorer

Single-page vinyl music explorer. Drop the needle, spin a crate (English / Hindi / Classical), and stream from Spotify while a local vinyl clip plays in sync.

No AWS. No CI/CD. No backend. Just `index.html` + `vinyl.mp4`.

## Features

- **Vinyl-first UX** — local `vinyl.mp4` animation timed to track load
- **Spotify PKCE login** — tokens stay in your browser (`localStorage`)
- **Premium full tracks** via Spotify Web Playback SDK
- **Free-account previews** when Spotify provides a `preview_url`
- **Next / Pause / Stop** that work against *this* app’s random crate picks (not Spotify’s unrelated queue)
- **Sharp geometry** — no rounded boxes

## Quick start

```bash
cd ~/Aesthete
python3 -m http.server 8765
# open http://localhost:8765
```

> Spotify OAuth **does not** work from `file://`. Always use a local HTTP server.

### One-time Spotify setup

1. Open [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Under **Redirect URIs**, add exactly what the in-app **Setup** screen shows  
   (e.g. `http://localhost:8765/` or `http://localhost:8765/index.html`)
4. Copy the **Client ID** → paste it in Aesthete **Setup** → **Save & connect**
5. Prefer **Spotify Premium** for full-length tracks in the vinyl player

Client ID is stored only in your browser (`localStorage`). There is no server-side secret.

## How playback works

| Account   | Behaviour |
|-----------|-----------|
| Premium   | Web Playback SDK streams full tracks to the “Aesthete Vinyl” device |
| Free      | 30s previews when available; otherwise open the track in Spotify |
| Next      | Stops current audio and loads a **new random track** from the same crate |
| Auto-next | After a short vinyl gap, another random track from the same crate |

Keyboard: `Space` pause/resume · `→` next · `Esc` close setup

## Files

```
index.html        # entire app (UI + logic)
vinyl-in.mp4      # sleeve → platter → needle down → spin-up
vinyl-loop.mp4    # constant RPM spin (loops while song plays)
vinyl-out.mp4     # spin-down → needle up → back into sleeve
README.md
LICENSE
walkthrough.mp4   # old demo video (optional)
```

### Vinyl sequence

1. **in** plays once when a track starts  
2. **loop** repeats while audio plays (pauses with Pause)  
3. **out** plays once on Next, track end, or Stop — then **in** again for the next track (Stop ends idle)

## Notes

- Curated playlist IDs are the original Aesthete crates (English / Hindi / Classical)
- If a playlist is private to another user or region-blocked, Spotify may return an error — try another crate
- Session tokens refresh automatically; use **Disconnect** to clear them

## License

See `LICENSE`.
