# Just Orange 🍊

**One input. One perfect dish. No decision paralysis.**

You name what’s in your kitchen. Just Orange names the **one** best recipe — no lists, no scrolling, no “pick one of five.”

Orange and white. Opinionated. Free by default.

---

## The idea

Choosing dinner is harder than cooking it.

Just Orange takes a few constraints — ingredients, taste, time, allergies — and returns **exactly one** dish. Local matching first (no API cost). Optional AI only if you turn it on.

---

## What’s included

| Surface | Path | Cost |
| -------- | ---- | ---- |
| **Landing** | `justorange.html` / `index.html` | Free static page |
| **Live Kitchen** | `live/live.html` | **$0** — 55 curated recipes, offline engine |
| **CLI** | `cli/just-orange.sh` | $0 idle; OpenAI key for generative mode |
| **Lambda** (optional) | `live/lambda/handler.py` | ~$0 idle; pay-per-use |

### Live Kitchen

- One winning recipe (taste, time, coverage, allergies)
- Free local brain — 55 recipes + synonym matching
- Pantry, history, favorites (browser `localStorage`)
- Shopping list for missing ingredients only
- Cook mode — step checklist + timers
- Print, copy, and share
- Quick combos and deep links (`#ing=tomato,rice,egg`)
- Optional cloud / OpenAI fallback in **Settings**

### CLI

- Interactive generate flow
- SQLite cache: view, delete, clear
- Local stats
- Token-capped `gpt-4o-mini` prompts via `core/recipe_engine.sh`

### Design

| Token | Value |
| ----- | ----- |
| Primary orange | `#FF6B35` |
| Soft orange | `#FF8C42` |
| Cream | `#FFFBF7` |
| Ink | `#1A1A1A` |

Shared UI system: `css/theme.css`.

---

## Quick start (free web)

```bash
cd ~/Just_Orange
python3 -m http.server 8080
```

Then open:

- http://localhost:8080/ — landing  
- http://localhost:8080/live/live.html — full kitchen  

You can also open the HTML files directly (`file://`); the local engine works offline with no server and no API key.

---

## CLI

**Dependencies:** `bash`, `curl`, `jq`, `sqlite3`, and an OpenAI API key.

```bash
cd ~/Just_Orange/cli
export OPENAI_API_KEY=sk-...
./just-orange.sh
```

Menu: create recipe · view cache · stats · exit.

---

## Architecture

```
Web (default, free)
  ingredients + taste + time + allergies
        ↓
  js/engine.js  →  score js/recipes.js  →  ONE recipe
        ↓
  js/storage.js (history, favorites, pantry, shopping)

Optional AI (Settings)
  weak local match → Lambda API and/or browser OpenAI
  (gpt-4o-mini, low max_tokens, cached)

CLI
  just-orange.sh → core/recipe_engine.sh → OpenAI → SQLite cache
```

---

## Repository layout

```
Just_Orange/
├── index.html               # Redirects to landing
├── justorange.html          # Landing page
├── css/theme.css            # Orange + white design system
├── js/
│   ├── recipes.js           # Curated recipe knowledge base (55)
│   ├── engine.js            # Matching engine — one winner
│   └── storage.js           # localStorage helpers
├── live/
│   ├── live.html            # Full kitchen app
│   └── lambda/handler.py    # Optional AWS Lambda
├── cli/
│   ├── cli.html             # CLI docs page
│   └── just-orange.sh       # Terminal app
├── core/
│   ├── recipe_engine.sh     # OpenAI + SQLite cache
│   ├── cache.db             # Created at runtime
│   └── GPT command          # Prompt notes
├── LICENSE                  # MIT
└── README.md
```

---

## Cost control

1. **Local first** — curated match before any network call  
2. **Cache everything** — SQLite locally; DynamoDB on AWS  
3. **Tiny prompts** — strict format, ~180 `max_tokens`  
4. **Cheap model** — `gpt-4o-mini` by default  
5. **Static hosting** — any CDN, S3, or even `file://`

---

## Optional AWS serverless

`live/lambda/handler.py` expects:

| Item | Detail |
| ---- | ------ |
| Env | `OPENAI_API_KEY` (required) |
| Optional env | `JO_MODEL`, `JO_MAX_TOKENS`, `JO_CACHE_TTL`, `JO_CACHE_TABLE` |
| DynamoDB | Table default `JustOrangeCache`, partition key `hash` (String) |
| Front door | API Gateway → Lambda |

Paste the API URL in Live Kitchen → **Settings** if you want cloud AI.

---

## License

MIT — free to fork, adapt, and cook with.

---

Made because deciding what to eat is hard enough.

**Just Orange** · orange & white forever.
