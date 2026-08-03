# Side Projects (rohandesai.in)

Site structure for **rohandesai.in**:

| URL | What |
|-----|------|
| `/` | Portfolio (`index.html` from Personal-sites) |
| `/projects/` | Project directory UI |
| `/projects/<id>` | Open a project (e.g. `/projects/gaia`, `/projects/zyra`) |
| `/projects/<id>/f/<path>` | Open a file in the browser |
| `/projects/<Folder>/…` | Raw source files served for the file viewer |

```
index.html              ← portfolio
worker.js               ← SPA fallback for /projects/*
wrangler.toml
projects/
  index.html            ← project browser (black & gold UI)
  projects.json         ← catalog + file trees
  Gaia/  Aesthete/ …    ← browsable source copies
```

## Local preview

```bash
cd "~/Side Projects"
python3 -m http.server 8765
# Portfolio:  http://localhost:8765/
# Projects:   http://localhost:8765/projects/
```

Deep links like `/projects/gaia` need the Worker (or any server that falls back to `projects/index.html`). With plain `http.server`, use the in-app navigation after opening `/projects/`.

## Deploy (Cloudflare Worker + Assets)

```bash
cd "~/Side Projects"
wrangler deploy
```

Point the custom domain **rohandesai.in** at this Worker.

## Portfolio → projects

The **View Project Details** button on the home page goes to `/projects/` (no popup).

## Private projects

Listed in the UI with contact for access (`pro.rohandesai@gmail.com`). No source in this repo for ZYRA, Film Connoisseur, Annara, Ada Wong, or private client tools.
