# Firebase App Check Rollout Plan

Last updated: 2026-07-13

## Goal

Protect EpisodEra's public HTTPS API and Firebase-backed identity flows from automated abuse without breaking legitimate browser users, CI smoke tests, or local emulator development.

App Check is the recommended complement to the current per-instance in-memory rate limits documented in `README.md`.

## Current exposure

| Surface | Auth today | Abuse risk |
| --- | --- | --- |
| `GET /search`, `GET /trending`, `GET /movie/:id`, `GET /tv/:id` | Public (optional auth) | TMDb proxy scraping, quota burn |
| Authenticated writes (`/watchlist`, `/progress`, `/me/*`) | Firebase ID token | Token farming if Auth signup is open |
| Firebase Auth (client) | Email/password | Scripted account creation |
| Firestore (client) | Not used directly | Low — all writes go through Functions Admin SDK |

Primary enforcement target: **Cloud Functions API** (`api`). Secondary target: **Firebase Auth** (via App Check on the web client). Firestore rules remain defense-in-depth; App Check on Firestore client SDK is not required while the web app avoids direct Firestore access.

## Recommended provider

Use **reCAPTCHA v3** for the web app.

- Fits the current browser-only MVP
- No native SDK work required yet
- Firebase Console can register the site key against the existing web app

Record these values outside git:

- reCAPTCHA v3 site key (web)
- reCAPTCHA secret (managed by Firebase App Check registration)

## Rollout phases

### Phase 0 — Baseline (no enforcement)

**Duration:** 1–2 days

1. Enable App Check for project `episodera` in Firebase Console.
2. Register the production web app with reCAPTCHA v3.
3. Add debug tokens for:
   - Local emulator development
   - GitHub Actions production smoke (if browser-based App Check is added later)
   - Maintainer machines
4. Ship client initialization in **monitoring-only** mode (token attached, backend not enforcing).

**Exit criteria:** App Check tokens appear in Firebase Console metrics for production traffic.

### Phase 1 — Client integration

**Code changes (web):**

1. Add `firebase/app-check` initialization in `web/src/firebase.ts`.
2. Load the reCAPTCHA site key from `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY`.
3. Skip App Check when `VITE_USE_FIREBASE_EMULATORS=true`; use `initializeAppCheck` debug provider locally instead.
4. Expose `getAppCheckToken()` helper for the API client.

**Code changes (API client):**

1. In `web/src/api/client.ts`, attach `X-Firebase-AppCheck` on requests when a token is available.
2. Do not block UI if App Check token fetch fails during Phase 1.

**Env additions:**

```plain text
# web/.env.production
VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY=...

# web/.env (local emulator)
VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN=...   # from Firebase Console debug token list
```

**Exit criteria:** Production requests include App Check headers; no user-facing errors.

### Phase 2 — Backend monitor mode

**Code changes (functions):**

1. Add `firebase-admin/app-check` verification middleware.
2. Log invalid or missing tokens with route name and `x-request-id`.
3. Do **not** reject requests yet.

Suggested middleware behavior:

```text
optionalAppCheck -> attach req.appCheck when valid
requireAppCheck  -> 401/403 only after Phase 3 flip
```

**Exit criteria:** One week of logs shows >95% of browser traffic presents valid tokens; smoke and emulator paths documented.

### Phase 3 — Enforce on authenticated writes

**Policy:**

- `requireAppCheck` on all `requireAuth` routes first.
- Keep public read routes on `optionalAppCheck` until Phase 4.

**Rollout:**

1. Deploy with enforcement behind env flag `APP_CHECK_ENFORCE_AUTH_WRITES=true`.
2. Enable in production during low-traffic window.
3. Monitor `401`/`403` rates and Firebase App Check metrics.

**Smoke test impact:**

- Production smoke uses Firebase Auth REST, not the web SDK. Configure:
  - Functions: `SMOKE_BYPASS_APP_CHECK=true` and `SMOKE_BYPASS_APP_CHECK_SECRET=<secret>`
  - Smoke / GitHub Actions: `EPISODERA_SMOKE_APP_CHECK_BYPASS=<same secret>` (sent as `X-EpisodEra-Smoke-Bypass`)
- Browser clients should keep using reCAPTCHA / App Check debug tokens; do not ship the smoke bypass secret to Hosting.

**Exit criteria:** No increase in support issues; authenticated API abuse metrics flat or down.

### Phase 4 — Enforce on public reads

**Policy:**

- Apply `requireAppCheck` to `GET /search`, `GET /trending`, and detail routes.
- Keep `GET /health` unauthenticated and without App Check for uptime probes.

**Mitigation for non-browser clients:**

- If partner or script access is needed later, issue App Check debug tokens or move those clients to a separate API key path.

**Exit criteria:** Public scrape attempts drop; legitimate web usage unaffected.

### Phase 5 — Auth hardening (optional)

1. Enable App Check enforcement for Firebase Authentication in Console.
2. Tighten sign-up rate limits or add email verification if scripted sign-ups persist.

## Implementation checklist

### Console

- [ ] App Check enabled for project `episodera`
- [ ] reCAPTCHA v3 provider registered for the web app
- [ ] Debug tokens created for local dev and CI
- [ ] Enforcement toggles left off until Phase 3/4

### Web (`web/`)

- [x] `initializeAppCheck` with reCAPTCHA v3 site key
- [x] Debug provider when `VITE_USE_FIREBASE_EMULATORS=true`
- [x] API client sends `X-Firebase-AppCheck`
- [x] `web/.env.production.example` documents new vars
- [x] `npm run build:prod` validation includes site key before Phase 3 (`EPISODERA_REQUIRE_APP_CHECK_SITE_KEY`, default true)

### Functions (`functions/`)

- [x] `verifyToken()` middleware using Admin App Check (`optionalAppCheck` / `requireAppCheck`)
- [x] Feature flags: `APP_CHECK_ENFORCE_AUTH_WRITES`, `APP_CHECK_ENFORCE_PUBLIC_READS`
- [x] Structured logs for missing (authenticated requests) / invalid tokens
- [x] Tests for middleware (valid, missing, invalid, smoke bypass)
- [ ] Mount `requireAppCheckPublic` on discovery routes when enabling Phase 4

### CI / smoke

- [x] Document App Check smoke bypass (`SMOKE_BYPASS_APP_CHECK` + `EPISODERA_SMOKE_APP_CHECK_BYPASS`)
- [ ] Confirm `Production Smoke` workflow still passes after enabling Phase 3 in production

### Docs

- [x] Update `docs/Authentication.md` with App Check flow
- [x] Update `docs/Deployment.md` pre-deploy checklist
- [x] Update `README.md` known gaps when enforcement is live

## Rollback

1. Set `APP_CHECK_ENFORCE_AUTH_WRITES=false` and `APP_CHECK_ENFORCE_PUBLIC_READS=false`; redeploy Functions.
2. Disable App Check enforcement in Firebase Console for Authentication if enabled.
3. Leave client token attachment in place (harmless) until the incident is resolved.

Rollback should not require a Hosting redeploy if enforcement is Functions-only.

## Testing matrix

| Environment | App Check provider | Enforcement |
| --- | --- | --- |
| Local emulators | Debug token | Off |
| Playwright E2E | Off (mocked API/auth) | Off |
| PR CI | Off | Off |
| Production smoke | Debug token (recommended) | Matches prod flags |
| Production users | reCAPTCHA v3 | Phased per above |

## Dependencies and sequencing

Complete before Phase 3:

1. Auth emulator support (done — `VITE_USE_FIREBASE_EMULATORS`, Auth emulator on port `9099`)
2. Canonical production API URL documented (`docs/FirebaseProject.md`)
3. Firebase dependency upgrade branch (`docs/DependencyAudit.md`) — not blocking, but schedule before major Console API changes

## Success metrics

- Reduction in anonymous `429 rate_limited` events on public reads
- No regression in production smoke pass rate
- App Check valid-token rate >95% for browser sessions
- Zero sustained increase in failed sign-in or watchlist/progress writes after Phase 3

## Out of scope (post-MVP)

- App Check on Firestore client SDK (not used today)
- Firebase Crashlytics (no web SDK)
- Native app providers (Play Integrity / DeviceCheck) until mobile clients ship
