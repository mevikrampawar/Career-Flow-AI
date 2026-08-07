# Security

This document records the security model of Career Flow AI and the results of a
full audit of every page, layout, component, and user flow (August 2026).

Everything runs client-side on GitHub Pages. Data lives in your own Firebase
project (`me-career-flow`). You sign in with Google, and you bring your own
API keys (Groq, Apify) and your own Google OAuth "Web application" Client ID
for Gmail. There is no backend server — all calls go straight from your browser
to Google, Groq, and Apify with your own credentials.

---

## 1. Threat model (what we protect)

| Asset | Where it lives | How it is protected |
|---|---|---|
| Google sign-in session | Firebase Auth | Google's own sign-in popup; no passwords or tokens in app code |
| Gmail access token | In memory only | Never written to `localStorage`, cookies, or Firestore |
| Gmail OAuth Client ID | Your Firestore `users/{uid}/settings/keys` | Owner-only Firestore rule; rendered only in Settings |
| Groq / Apify API keys | Your Firestore `users/{uid}/settings/keys` | Owner-only Firestore rule; shown only in Settings |
| Resume, applications, saved/scraped jobs | Your Firestore `users/{uid}/data/*` | Owner-only Firestore rule |
| Offline cache | Browser `localStorage` | Partitioned per account (`career-flow:*:{uid}`) |

The Firestore security rules are the backstop: **no one but you can read or
write your data, because every path is under `/users/{uid}` and gated by
`request.auth.uid == userId`.**

---

## 2. Audit results — verified in code

### 2.1 Firestore rules (`firestore.rules`)
```js
match /users/{userId}/{document=**} {
  allow read, create, update, delete: if request.auth != null
    && request.auth.uid == userId;
}
```
- Ownership enforced on every read **and** every write (create/update/delete).
- No public collection, no wildcard top-level rules, no `request.resource.data`
  used as an authority source. Role/data you send is your own.
- There is no Cloud Storage, Realtime DB, or Hosting in use, so no extra
  storage rules are needed (`firebase.json` only configures Firestore).

**Minor gaps (self-impact only):** rules do not cap field sizes/array lengths
or type-check every field, so a compromised client could store oversized data
in *its own* documents. Add `request.resource.data.size() < X` / `is string`
checks if you want hard limits. Nothing here affects other users.

### 2.2 Gmail flow (`src/lib/gmail.ts`, `src/lib/GmailProvider.tsx`)
- **Tokens are memory-only** — `cachedToken` is a module variable; nothing is
  persisted. Reloading the tab forces a silent re-auth against Google.
- **Minimal scopes** — exactly two, no delete/insert/modify:
  `gmail.send` and `gmail.readonly` (readonly is what lets the app show you the
  reply thread). Both are "sensitive" Google scopes shown on the consent screen.
- **No token in URLs** — Google Identity Services popup flow; nothing is read
  from `location.hash`/`location.search`, so the token can't leak via history,
  referrer, or logs.
- **Explicit revoke** — Disconnect calls `google.accounts.oauth2.revoke` and
  clears the in-memory token and the `career-flow:gmail-connected` flag.
- **Silent restore** — a previously connected browser reuses the existing grant
  without showing a consent prompt.
- **Error handling** — 401 → "reconnect"; 403 → "check scopes/API enabled".
- **Header injection** — recipient/subject/filename values are sanitized
  (CR/LF stripped) and RFC 2047-encoded before MIME is built.

### 2.3 Sign-in & routing (`src/lib/auth.tsx`, `src/components/layout/AppShell.tsx`)
- Google-only sign-in via Firebase Auth popup. There is **no local-only mode**
  and no anonymous access to app data.
- Every `/app` route is gated: `AppShell` shows a spinner until auth resolves,
  then redirects to `/signin` if there is no user.
- Landing and Sign-in pages are public by design (they contain no user data).

### 2.4 XSS & injection sweep
Scanned every component for `dangerouslySetInnerHTML`, `innerHTML`,
`document.write`, `eval`, `new Function`. **Zero matches.** All dynamic content
(scraped job listings, Gmail reply bodies, resume text) is rendered through
React's default text escaping. `stripHtml` extracts text via `DOMParser`
`textContent` — it never parses back into markup.

### 2.5 Content Security Policy (new)
The production build now injects a CSP meta tag (GitHub Pages cannot send HTTP
headers). Key directives: `script-src 'self'` (no `unsafe-inline` — the build
contains zero inline scripts), `object-src 'none'`, `frame-src` limited to
Google domains, and `connect-src` limited to the exact APIs the app calls
(Firebase Auth, Firestore, Gmail, Groq, Apify, GIS). If any future feature
needs a new origin, it must be added to `injectCsp()` in `vite.config.ts`.

### 2.6 Secrets handling
- **No hardcoded secrets** in source. Firebase web config values are public
  client config by definition (they ship in every browser bundle).
- User keys live only in the user's own Firestore doc and are never logged.
- `console.log`/`debug`/`info` sweep: **zero** matches in `src/`.
- `.env.local` and `*.local` are gitignored. The deploy workflow injects
  config from GitHub Actions secrets.

### 2.7 Dependencies
`npm audit` reported 2 moderate advisories in `react-router-dom` (open redirect
via backslash; SSR hydration deserialization). Upgraded to `react-router-dom`
`7.18.2`. The only remaining advisory (GHSA-qwww-vcr4-c8h2, RSC-mode CSRF)
targets React Server Components/actions — this app is a pure client-side SPA
with no SSR/RSC, so it is not applicable. Re-run `npm audit` after any
dependency change.

### 2.8 Per-account data isolation
- `localStorage` caches are partitioned per user uid (`career-flow:keys:{uid}`
  and the sync high-water marks), and switching accounts clears the previous
  account's offline store — one account's keys/jobs can't leak into another's
  browser profile.
- The OAuth **Client ID is a per-user value** (BYOK): each user connects Gmail
  with their own published client, and their token authorizes only their inbox.

---

## 3. Things to verify in the Google/Firebase consoles (one-time)

These live outside the code and can only be changed by you in the consoles.
All links open the right page.

1. **Firebase API key restrictions** — restrict the web API key to your
   origins and only the APIs you use:
   - [Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   - Add *HTTP referrers*: `https://mevikrampawar.github.io/*` and
     `http://localhost:5174/*`
   - Optionally, in *API restrictions*, allow only Identity Toolkit,
     Token Service, Firestore, and Gmail API.
2. **Firebase Auth authorized domains** — keep it to your site:
   - [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/me-career-flow/authentication/settings)
   - Ensure only `mevikrampawar.github.io`, `localhost`, and the
     `me-career-flow.firebaseapp.com` default are listed.
3. **Enabled sign-in providers** — leave only Google enabled:
   - [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/me-career-flow/authentication/providers)
4. **Firestore rules deployed** — the repo rules must be deployed so the
   web-visible rules match:
   - [Firebase Console → Firestore → Rules](https://console.firebase.google.com/project/me-career-flow/firestore/rules)
   - Confirm `request.auth.uid == userId` ownership is live (deploy via
     `npx -y firebase-tools@latest deploy --only firestore:rules` if the repo
     version is newer).
5. **Gmail OAuth consent screen** — since you published the app, confirm it
   reads **"In production"** with exactly these scopes:
   - [Google Cloud → APIs & Services → OAuth consent screen](https://console.cloud.google.com/auth/audience)
   - Scopes: `gmail.send`, `gmail.readonly`
6. **Gmail API enabled**:
   - [Google Cloud → Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
7. **Web client origins** — your OAuth Web client should allow exactly:
   `https://mevikrampawar.github.io` and `http://localhost:5174`:
   - [Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

---

## 4. Residual risks (accepted, with mitigations)

| Risk | Mitigation | Notes |
|---|---|---|
| A malicious browser extension or XSS reads data | React escaping + CSP without `unsafe-inline`; tokens are memory-only | Extension can still read DOM/localStorage — out of app control |
| `gmail.readonly` grants read of your whole mailbox | Only used to show reply threads; token never persisted; revocable anytime in your Google account | Can be tightened to `gmail.metadata` (headers + snippets only, no full bodies) if you prefer — reply tracking still works; say the word |
| Keys visible to anyone who signs in as you | Keys only render inside Settings behind the auth gate | An attacker with your Google login is "you" — protect your Google account (2FA) |
| Someone else uses your public API key on the web API key | API key restriction limits referrers (console task #1) | Web keys are public by design; restriction is the control |

## 5. Security hygiene checklist (ongoing)

- Re-run `npm audit` and `npm run lint` before every release.
- Never add non-public values to `.env.example` or commit `.env.local`.
- If you add a new third-party endpoint, update `injectCsp()` `connect-src`.
- Review the Firestore rules before adding any new collection.
