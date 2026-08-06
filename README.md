# Career Flow AI

Automate your job hunt — entirely from the browser. Upload a resume, scrape live openings, AI-score matches, and generate tailored application materials.

**Client-side by design.** No backend servers. All AI and scraping calls run from your browser with **your own API keys (BYOK)**. Your data stays in your browser's localStorage and — when signed in with Google — in **your own Firestore** project.

## Features

| Feature | How it works |
| --- | --- |
| Resume parsing | Upload a PDF → parsed locally with `pdf.js` → analyzed by **Groq** into a structured profile (skills, experience, education, projects) |
| Automated job hunt | Scrape live openings from **LinkedIn, Indeed, Workable** using **Apify** actors (BYOK token) |
| AI match scoring | Every job is scored 0–100 against your resume with strengths, gaps, and ATS keyword suggestions |
| Assisted apply | Tailored summary + achievement bullets + cover letter generated per role, then jump to the application |
| Application tracking | Pipeline statuses: draft → applied → interview → offer / rejected |
| Resume profile editing | Edit extracted profile (contact, summary, skills) directly, no re-upload needed |
| Application notes | Per-application notes for interview prep, contacts, and follow-ups |
| BYOK key vault | Groq + Apify keys saved to localStorage and synced to your own Firestore document when signed in |

## Tech stack (100% free & open source)

- **Vite + React + TypeScript** — SPA
- **Tailwind CSS v4** — design system implemented from Google Stitch's *Kinetic Professional* tokens
- **Groq** — resume analysis, job matching, cover letters (`llama-3.3-70b-versatile`)
- **Apify** — job board scraping
- **Firebase Auth (Google)** + **Firestore** — optional cloud sync of keys/profile
- **GitHub Actions** — auto-deploy to GitHub Pages on every push to `main`

## Get started

```bash
npm install
npm run dev          # local dev
npm run build        # production build -> dist/
```

### 1. Add your API keys

Open the app → **Settings**. Bring your own free keys:

- **Groq** → `console.groq.com` (free tier)
- **Apify** → `console.apify.com` (free monthly credits)

Both have a "Test connection" button. Keys work immediately from the browser.

### 2. Enable Firebase (optional but recommended)

Copy `.env.example` to `.env.local` and fill in your Firebase web app config
(Firebase console → Project settings → Your apps). The project ID is `me-career-flow`.

```bash
cp .env.example .env.local
```

Deploy the security rules (only the account owner can read/write their own data):

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only firestore:rules --project me-career-flow
```

> **Note:** Firebase config values are **public** client config (that's how every
> Firebase web app works) — safety comes from the Firestore security rules, not
> from hiding the config.

### 3. Deploy to GitHub Pages

Pushing to `main` triggers `.github/workflows/deploy.yml` which builds and
deploys to Pages. For the Firebase build config, set these **repository
secrets** (they mirror the `.env` vars):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

Then enable Pages (Settings → Pages → Source: **GitHub Actions**).

Live site: `https://mevikrampawar.github.io/Career-Flow-AI/`

## Project structure

```
.github/workflows/     CI: build + deploy to Pages
public/                static assets (favicon)
firestore.rules        Firestore security rules (owner-only access)
src/
  lib/                 groq.ts, apify.ts, resume.ts, firebase.ts, keys.tsx, auth.tsx
  store/               zustand app store (localStorage-persisted)
  components/          ui primitives + layout + JobCard
  pages/               Landing, SignIn, Dashboard, Resume, Jobs, Apply, Applications, Settings
```

## Design sync with Google Stitch

The UI implements the Stitch project **"Career Flow"** design system
(*Kinetic Professional* — Geist type, `#0052ff` action blue, Material-ish
color tokens, 4px spacing rhythm, rounded geometry). Tailwind theme tokens in
`src/index.css` mirror the Stitch DESIGN.md 1:1 so generated Stitch screens and
the shipped app stay visually consistent.

## Notes & roadmap

- **Assisted apply, not full auto-submit.** Career Flow prepares everything and
  opens the application page; real form auto-submission is board-dependent and
  against most job sites' ToS.
- Scrape result schemas vary by Apify actor; normalizers in `src/lib/apify.ts`
  handle common fields.
- Ideas: multi-resume profiles, apply-source analytics, application reminders,
  public job-board aggregation, edit experience/education inline.
