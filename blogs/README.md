# Inkboard (blogs)

## Static site (GitHub → Cloudflare · rohandesai.in)

| URL | File |
|-----|------|
| `/blogs/` | `index.html` |
| `/blogs/game-theory/` | `game-theory/index.html` |
| `/blogs/poker/` | `poker/index.html` |
| `/blogs/geopolitics/` | `geopolitics/index.html` |
| `/blogs/geography/` | `geography/index.html` |
| `/blogs/post/?slug=…` | `post/index.html` |
| `/blogs/write/` | `write/index.html` |

Push the Side Projects repo — no Wrangler for static HTML.

`js/config.js` points at the API Worker and sets `INKBOARD_BASE = "/blogs"`.

## API Worker (Wrangler · D1 + R2 + KV)

Inkboard uses the shared `vault-plates` D1 database. Its Worker, R2 bucket, and KV namespaces remain separate. Shared D1 migrations live in `../architecture/migrations`; the old `migrations/` files record the original Inkboard database history and are no longer applied.

Deploy API only:

```bash
cd "~/Side Projects/blogs"
npm install
npm run db:remote    # applies shared vault-plates migrations
npm run deploy
npm run secret:password   # if needed
```

Worker: `https://inkboard-blogs.rohandesai98244.workers.dev`  
Topics: game-theory · poker · geopolitics · **geography**
