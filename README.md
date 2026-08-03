# Side Projects

A browsable directory of things I’ve built — side projects, playgrounds, and finished experiments.

Open **[index.html](./index.html)** (via a local server or GitHub Pages) for a minimal UI that lists projects, short blurbs, and file trees. You can read source in the browser without git history or other repo ceremony.

```bash
cd "~/Side Projects"
python3 -m http.server 8765
# → http://localhost:8765
```

---

## Who

**Rohan Desai** — Cloud, DevOps & SRE

- Portfolio: [rohandesai.in](https://rohandesai.in/)
- GitHub: [OneRohanDesai](https://github.com/OneRohanDesai)
- Email: [pro.rohandesai@gmail.com](mailto:pro.rohandesai@gmail.com)

---

## Layout

```
index.html          ← project browser (single page, CSS + JS inlined)
projects.json       ← catalog + file trees (generated)
projects/           ← copied source for projects you can open here
  Aesthete/         …
  Gaia/             …
  playground/       ← small HTML experiments
```

Sources were **copied** (not moved) from other repos. Originals still live in `Archived_Projects`, `Personal-sites`, and standalone GitHub repos.

---

## Public / browsable here

| Project | What it is |
|---------|------------|
| **Aesthete** | Cinematic Spotify listening gallery (live) |
| **Aesthete Vinyl** | Original vinyl-first music SPA |
| **Just Orange** | One-input recipe picker |
| **The Table V3** | LAN restaurant operations OS |
| **The Waitlist** | Simple waitlist + queue engine |
| **Gaia** | Multi-cluster K8s world-population sim |
| **Nexu** | AWS DevOps/SRE infra (Terraform, EKS) |
| **Nyx Cloud** | IaC deploy platform snapshot (patent filed) |
| **Telemetry Playground** | DevOps / observability baseline |
| **Grounds** | Local cloud & DevOps practice arena |
| **Baby Linux** | One-script Arch/Linux workstation bootstrap |
| **Playground** | Companies, Darkside, QuantumXQuant, Vogue, YO Chico |

---

## Private (contact for code access)

These run (or will run) in production, or hold personal data — source is **not** in this repo.

| Project | Notes |
|---------|--------|
| **ZYRA** | Food platform — [zyra.rohandesai.in](https://zyra.rohandesai.in) |
| **Film Connoisseur** | Live film rankings — [film-connoisseur.rohandesai.in](https://film-connoisseur.rohandesai.in/) |
| **Annara** | Long-term physics / finance / tech (postponed) |
| **Ada Wong** | Local-only personal AI companion |
| **Personal Sites / client tools** | Private portfolio & client stock tools |

Want the code? Email **pro.rohandesai@gmail.com** with the project name.

---

## Notes

- Large demo videos for Nyx Cloud’s platform walkthrough stay in [Archived_Projects](https://github.com/OneRohanDesai/Archived_Projects/tree/main/NyxCloud); a smaller admin demo may be included here.
- Secrets (`.env`, live configs, databases, model weights) were not copied.
- `projects.json` describes every browsable path. After adding files under `projects/`, regenerate it (or ask me to) so the UI stays in sync.

---

> Built to be looked at, not just cloned.
