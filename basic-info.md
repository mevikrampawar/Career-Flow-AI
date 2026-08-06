# Career Flow AI — Basic Info

## Product
SaaS platform: upload a resume, automate job hunting & assisted applying.
100% client-side (no backend), open-source, all-free stack, BYOK for AI/scraping.

## Key decisions
- **Client-side SPA** — Vite + React + TypeScript + Tailwind CSS v4
- **BYOK (Bring Your Own Key)** for all AI APIs — Groq (analysis) + Apify (scraping)
- **API keys storage** — localStorage + Firebase Firestore (per-user doc, owner-only rules)
- **Hick's law approach** — minimal nav (5 items), guided flows, clear primary actions
- **Assisted apply** (not full auto-submit) — generate tailored resume + cover letter, open application page

## Services
| Service | Use | Account |
| --- | --- | --- |
| Groq | Resume analysis, job matching, cover letters | BYOK (free tier) |
| Apify | Job board scraping (LinkedIn/Indeed/Workable) | BYOK (free credits) |
| Firebase Auth (Google) | Sign-in | project `me-career-flow` |
| Firebase Firestore | Cloud sync of keys/profile | project `me-career-flow` |
| Google Stitch (MCP) | Design system + screen design | project `Career Flow` |
| GitHub Pages | Hosting | repo `mevikrampawar/Career-Flow-AI` |

## Firebase
- Project ID: `me-career-flow`
- Web config → fill `.env.local` from `.env.example` (apiKey, authDomain, appId, senderId)

## Repo / deploy
- Remote: `git@github.com:mevikrampawar/Career-Flow-AI.git`
- Auto-deploy to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`

## Stitch design system
- Project: **Career Flow** — design system **"Kinetic Professional"**
  (Geist, `#0052ff`, light mode, Material color tokens, 4px rhythm, 8/16px radii)
- Implemented as Tailwind tokens in `src/index.css` — kept 1:1 in sync with Stitch.
