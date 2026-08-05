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

Existing resources kept. Deploy API only:

```bash
cd "~/Side Projects/blogs"
npm install
npm run db:remote    # applies migrations (incl. geography topic)
npm run deploy
npm run secret:password   # if needed
```

Worker: `https://inkboard-blogs.rohandesai98244.workers.dev`  
Topics: game-theory · poker · geopolitics · **geography**
