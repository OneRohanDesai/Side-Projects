# Inkboard

A quiet writing system for three rooms of thought:

**Game Theory** · **Poker** · **Geopolitics**

You write in a block canvas (text, headings, quotes, callouts, symbols, images, gifs, video, lists, code).  
Readers open a soft ledger of published pieces. Private drafts stay behind a password.

This lives inside `Side Projects/blogs` as a **Cloudflare Worker** (API + UI).  
No nested git repo. Deploy with Wrangler from this folder.

---

## Stack (free Cloudflare tier)

| Piece | Role |
|-------|------|
| **Worker** | API + hosts the static Inkboard UI |
| **D1** | Posts database |
| **R2** | Images, gifs, videos |
| **KV** | Login sessions (+ cache version) |

---

## First time setup

```bash
cd "~/Side Projects/blogs"
npm install

# Apply database tables (local + remote)
npm run db:local
npm run db:remote

# Set your writing password (interactive; not stored in git)
npm run secret:password
# for local dev, copy example and edit:
cp .dev.vars.example .dev.vars
```

---

## Develop

```bash
npm run dev
# open http://localhost:8787
# write studio: http://localhost:8787/write.html
```

---

## Deploy (no git push required)

```bash
npm run deploy
```

Wrangler prints a `*.workers.dev` URL. That URL is your live Inkboard  
(API under `/api/*`, site under `/`).

Optional: attach a custom route such as `blogs.rohandesai.in` in the Cloudflare dashboard.

---

## Writing

1. Open `/write.html`
2. Enter `ADMIN_PASSWORD`
3. Pick a topic, add blocks, upload media
4. Save as **Draft** or **Published**

Published pieces appear on the home ledger and topic rooms.

---

## Notes

- Media max ~25MB per file (Worker body limit awareness). Prefer compressed video.
- Public list only shows `published` posts. Admins can load `status=all` via the studio.
- Static files sit in `public/`; Worker code in `src/`.
