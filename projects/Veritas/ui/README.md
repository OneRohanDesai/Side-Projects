# VERITAS Console

Sleek local-first engineering intelligence UI.

```bash
# terminal 1
cd ~/Veritas && cargo run -p veritas-api

# terminal 2
cd ~/Veritas/ui && npm install && npm run dev
```

Open http://127.0.0.1:5173

API defaults to http://127.0.0.1:7420 (`VITE_API_URL` optional; Vite proxies `/v1` in dev).
