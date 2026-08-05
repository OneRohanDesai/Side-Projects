# Vault (architecture)

Museum catalog of man-made and natural structures + password editorial.

## Static site (GitHub → Cloudflare)

You push this folder with the rest of Side Projects. Live paths:

- Catalog: `https://rohandesai.in/architecture/`
- Editor: `https://rohandesai.in/architecture/editor/` (password)

No Wrangler needed for HTML/CSS/JS.

## API (Wrangler only)

Metadata (D1) + images (R2) + sessions (KV) live on a separate Worker:

```bash
cd "~/Side Projects/architecture"
npm install
npm run db:remote
npm run seed:remote          # optional: load initial plates
npm run secret:password      # set editor password
npm run deploy
```

Then set the Worker URL in `js/config.js`:

```js
window.VAULT_API = "https://vault-api.<your-subdomain>.workers.dev";
```

### Local API

```bash
cp .dev.vars.example .dev.vars   # set ADMIN_PASSWORD
npm run db:local && npm run seed:local
npm run dev                      # http://localhost:8787
# point VAULT_API to http://localhost:8787 while testing
```

If the API is down, the catalog falls back to `data/structures.json`.
