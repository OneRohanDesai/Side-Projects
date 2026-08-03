# The Waitlist

Dead-simple waitlist software with a rock-solid queue engine.

One product. Run it on your laptop, a LAN server, a VPS, or Docker.  
No SaaS lock-in. No dual “free vs paid” editions. Fork it, host it, change it.

**License: MIT** — free for anyone, for any purpose (personal, commercial, whatever).

---

## Features

- **Queues** — create, archive, permanently delete; personal / org / role visibility  
- **Live line** — add people, call next, seated / no-show, reorder, edit entries  
- **History** — re-add guests; multi-select delete  
- **Public join** — shareable link + QR; guest live status page  
- **Browser alerts** — optional notification when a guest is called  
- **Auth** — argon2id passwords, HttpOnly sessions, CSRF, lockout, rate limits  
- **Teams** — organizations, join codes, custom roles (receptionist, waiter, …)  
- **LAN share** — phones on the same Wi‑Fi use the browser (no native apps)  
- **Realtime** — WebSockets across devices, smooth throttled sync  
- **SQLite** — zero extra services; data under `data/waitlist.db`

---

## Quick start (development)

**Requirements:** [Bun](https://bun.sh) 1.1+

```bash
git clone <your-fork-or-this-repo> the-waitlist
cd the-waitlist
bun install

# Terminal 1 — API + WebSocket
bun run dev:server

# Terminal 2 — UI
bun run dev:web
```

Open **http://localhost:5173**

---

## Production (single process)

Build the UI, then run one Bun server that serves API + static UI + WebSockets:

```bash
bun install
bun run prod
# → http://0.0.0.0:3001
```

Or:

```bash
bun run build
bun run start
```

SQLite path defaults to `./data/waitlist.db` (override with `DATABASE_URL`).

### Docker

```bash
docker compose up --build -d
# → http://localhost:3001
```

Data persists in the `waitlist-data` volume.

---

## How to use

1. Open the app → **Log in** / **Create account** (header)  
2. **Individual**, **Join org** (search + join code), or **Register org**  
3. **New queue** — personal or shared with the team  
4. Share **join link / QR** with guests; use **LAN** for phones on Wi‑Fi  
5. Managers: **Team** → join codes, roles, members  

---

## Project layout

```
the-waitlist/
├── apps/
│   ├── server/     # Hono API, auth, WebSocket, static UI in prod
│   └── web/        # SvelteKit + Tailwind
├── packages/
│   └── core/       # Schema, QueueEngine, OrgService
├── data/           # SQLite (gitignored)
├── Dockerfile
└── docker-compose.yml
```

---

## Security notes

| Control | Detail |
|--------|--------|
| Passwords | argon2id, strict policy |
| Sessions | HttpOnly + SameSite=Strict cookie; only hash stored |
| CSRF | `X-CSRF-Token` on staff mutations |
| Lockout | 5 failed logins → 15 minutes |
| Rate limits | login, signup, public join |
| Staff API | auth required once accounts exist |
| Public join | open + rate-limited |

Set `COOKIE_SECURE=1` behind HTTPS. Set `TRUST_PROXY=1` only behind a trusted reverse proxy.

---

## Environment

See `.env.example`:

```
PORT=3001
HOST=0.0.0.0
DATABASE_URL=./data/waitlist.db
CORS_ORIGIN=http://localhost:5173
```

---

## Tests

```bash
bun test
```

---

## This project

Built as a conceptual / learning app. Not a commercial product.

You can run it only on your machine, or deploy it for a restaurant, clinic, or event.  
Contributions and forks are welcome under MIT.

---

## License

[MIT](./LICENSE)
