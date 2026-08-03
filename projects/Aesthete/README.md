# Aesthete

A cinematic **listening gallery** for curated Spotify playlists — not a generic music app.

Live: [aesthete.rohandesai.in](https://aesthete.rohandesai.in)

## What it is

Horizontal “rooms” (your playlists), editorial track lists (name + artists only — no per-song art), color atmosphere pulled from each playlist cover, full browser playback via the Spotify Web Playback SDK (Premium), and a set of listening rituals:

| Feature | Why it exists |
|--------|----------------|
| **Gallery rail** | Scroll-snap rooms — enter one playlist like a gallery wing |
| **Cinema mode** (`F`) | Full-viewport now-playing: title, artists, progress only |
| **Command palette** (`⌘K` / `/`) | Search every track across every room |
| **Weave** | Mark rooms with ✦ → never-repeat shuffle across them |
| **Focus timer** | 15 / 25 / 45 / 60 min — music stops when the session ends |
| **Listening journal** | Private, local-only history of what you played |
| **Keyboard-first** | Space, ←→, G gallery, Q rituals, Esc exit cinema |
| **Deep links** | `/room/:id` shareable rooms |
| **Atmosphere** | Dominant color from playlist cover washes the UI |

## Stack

- **React 19 + Vite** SPA
- **Hono** API on **Cloudflare Workers**
- **KV** catalog cache
- **Spotify Web API + Web Playback SDK**

## One-time setup

### 1. Spotify Developer app

1. Open [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create app**
2. Redirect URIs (add both — Spotify requires **https** even for localhost):
   - `https://aesthete.rohandesai.in/api/auth/callback`
   - `https://localhost:5173/api/auth/callback` (local dev)
3. Copy **Client ID** and **Client Secret**

### 2. Secrets on Cloudflare

```bash
cd ~/Aesthete
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET   # any long random string
```

Optional — keep the public catalog fresh without re-logging in:

```bash
# After you connect once, grab a refresh token from the browser cookie session
# or re-auth and store it:
npx wrangler secret put SPOTIFY_OWNER_REFRESH
```

### 3. Local dev (HTTPS)

Spotify only allows `https://localhost` redirect URIs (not `http://`). This project runs Vite with a self-signed cert.

```bash
cp .dev.vars.example .dev.vars
# fill SPOTIFY_* and SESSION_SECRET
# APP_URL / SPOTIFY_REDIRECT_URI should be https://localhost:5173 ...
npm install
npm run dev
```

Open **https://localhost:5173** (accept the browser cert warning once) → **Connect Spotify** → **Studio** → paste playlist links → **Publish**.

### 4. Deploy

```bash
npm run deploy
```

Custom domain `aesthete.rohandesai.in` should already be attached to the `aesthete` Worker in the Cloudflare dashboard. If not: Workers → aesthete → Settings → Domains & Routes → add custom domain.

## How the catalog works

1. You connect Spotify → you land in **Studio** (`/studio`)
2. Paste public playlist links (one per line) — only these appear on the site
3. Click **Publish to gallery** — tracks are fetched and cached in KV (playlist cover only; song rows are name + artists)
4. Anyone can browse without logging in
5. **Connect Spotify Premium** to play in the browser (Web Playback SDK requirement)

Sessions are stored in KV (not giant cookies), so login actually sticks.

## Scripts

| Command | |
|---------|--|
| `npm run dev` | Vite + Worker local |
| `npm run build` | Production build |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run cf-typegen` | Regenerate Worker types |

## Keyboard map

- `Space` — play / pause  
- `←` / `k` — previous  
- `→` / `j` — next  
- `/` or `⌘K` — search  
- `F` — cinema mode  
- `G` — gallery  
- `Q` — rituals drawer  
- `Esc` — close overlays / leave cinema  
