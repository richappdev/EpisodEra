# Episodera

Episodera is a movie and TV tracking app for discovering titles, saving a watchlist, tracking episode progress, and reviewing profile stats. The current MVP is a React/Vite web app backed by Firebase Auth, Firestore, Firebase Functions, and TMDb metadata.

## Current Status

The project is in MVP hardening. Core web features are implemented, progress-tracking reliability fixes are in place, and GitHub Actions runs Java-backed Firestore emulator tests (`npm run test:emulator`) on hosted CI. The remaining work is dependency upgrade planning, deeper accessibility validation, repeat hosted production-smoke evidence for future release candidates, and production-readiness decisions.

## Features

- Email/password authentication with Firebase Auth.
- Signed API requests using Firebase ID tokens.
- Home discovery with trending movies and TV shows.
- Search for movies and TV shows.
- Movie detail pages with normalized TMDb metadata.
- TV detail pages with seasons and episode metadata.
- Watchlist management:
  - add titles
  - remove titles
  - change TV status to `planned`, `watching`, `completed`, or `dropped`
  - change movie status to `unwatched` or `watched`
- User-owned Firestore watchlist storage.
- TV episode progress tracking:
  - season selector
  - episode list
  - mark watched
  - mark unwatched
  - batch watched/unwatched updates
  - backend-resolved canonical TMDb episode metadata
  - atomic progress, episode, and history updates
  - watched count
  - progress percentage
- Continue Watching shortcuts for in-progress TV shows using the backend-calculated next unwatched episode.
- Profile and stats:
  - watched movies
  - watched episodes
  - currently watching count
  - completed shows count
  - saved title count
  - tracked show count
- Recent watched history timeline for movies and episodes.
- Owner-scoped Firestore security rules for watchlist, progress, and history.
- Firebase Analytics and Performance Monitoring for the web app.
- GitHub Actions CI for backend build, backend lint, backend unit tests with coverage enforcement, Java-backed Firestore emulator tests, frontend build, frontend component coverage enforcement, and Playwright critical-flow, progress edge-case, and responsive/accessibility smoke coverage.
- GitHub Actions `Production Smoke` workflow for manual-dispatch or scheduled deployed signed-in validation using protected repository secrets.
- Account deletion manually validated on 2026-07-13 against the deployed app (`DELETE /me/account`, Auth removal, Firestore cleanup) using a throwaway account.
- URL routing and shareable deep links with React Router (`/`, `/search`, `/movie/:id`, `/tv/:id`, `/watchlist`, `/profile`, `/settings`, `/login`, `/signup`).
- Project documentation for architecture, API contracts, Firestore schema, auth, navigation, deployment, coding standards, and dependency audit posture.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, React Router, Firebase Web SDK
- Backend: Firebase Cloud Functions, Express, TypeScript
- Auth: Firebase Authentication
- Database: Firestore
- Monitoring: Firebase Analytics, Firebase Performance Monitoring, Analytics exception events for web errors
- Metadata provider: TMDb API
- CI: GitHub Actions

## Repository Layout

```text
.
├── docs/
│   ├── API.md
│   ├── Architecture.md
│   ├── Authentication.md
│   ├── CodingStandard.md
│   ├── DependencyAudit.md
│   ├── Deployment.md
│   ├── Firestore.md
│   ├── Navigation.md
│   └── ResourceAlignment.md
├── functions/
│   ├── src/
│   │   ├── api/
│   │   ├── config/
│   │   ├── integrations/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── services/
│   ├── eslint.config.mjs
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── firebase.json
├── firestore.indexes.json
└── firestore.rules
```

## Backend API

The backend exposes one Firebase HTTPS Function named `api`.

Read-only endpoints:

- `GET /health`
- `GET /search?q={query}&page={page}`
- `GET /trending?page={page}`
- `GET /trending/movie?page={page}`
- `GET /trending/tv?page={page}`
- `GET /trending/shows?page={page}`
- `GET /movie/:id`
- `GET /tv/:id`
- `GET /tv/:id/season/:seasonNumber`

Authenticated user endpoints:

- `GET /watchlist`
- `POST /watchlist`
- `PATCH /watchlist/:itemId/status`
- `DELETE /watchlist/:itemId`
- `GET /progress`
- `GET /progress/:showId`
- `POST /progress/:showId/episode`
- `POST /progress/:showId/episodes/batch`
- `DELETE /progress/:showId/episode/:episodeKey`
- `GET /me/stats`
- `GET /me/history`
- `GET /me/profile`
- `PATCH /me/profile`
- `GET /me/settings`
- `PATCH /me/settings`

Progress writes accept season and episode numbers only. The backend validates against TMDb, resolves canonical titles and episode counts, and writes episode rows, progress summary, and watched history in one Firestore transaction. `GET /progress` returns summary rows only; use `GET /progress/:showId` when full watched episode rows are required.

See `docs/API.md` for full request and response contracts.

## Local Setup

Install dependencies:

```bash
cd functions
npm install

cd ../web
npm install
```

Configure local environment values:

- Root `.env` from `.env.example` for backend/Firebase emulator values.
- `web/.env` from `web/.env.example` for local Vite and Firebase web values.
- Set `VITE_USE_FIREBASE_EMULATORS=true` in `web/.env` when using local Auth/Functions/Firestore emulators.
- `web/.env.production` from `web/.env.production.example` for production hosting builds. This file is gitignored; create it on the machine that builds and deploys Firebase Hosting.
- Firebase secret `TMDB_API_KEY` for deployed functions.
- Optional `CORS_ORIGINS` comma-separated allowlist for deployed API origins. Leave unset only for local development.
- Optional rate-limit overrides: `PUBLIC_READ_RATE_LIMIT_MAX`, `PUBLIC_READ_RATE_LIMIT_WINDOW_MS`, `AUTH_WRITE_RATE_LIMIT_MAX`, and `AUTH_WRITE_RATE_LIMIT_WINDOW_MS`.

For local emulator development, Java is required by the Firestore emulator. Start Auth, Functions, and Firestore together with `npm run serve` in `functions/`, then run the web app with `VITE_USE_FIREBASE_EMULATORS=true`. See `docs/Authentication.md`.

## Development Commands

Backend:

```bash
cd functions
npm run build
npm run lint
npm test
npm run test:coverage
npm run test:emulator
npm run serve
```

`npm test` builds the functions TypeScript and runs Node test files emitted into `lib/`. `npm run test:coverage` uses Node's built-in test coverage with baseline thresholds for backend unit and route-test coverage. Firestore emulator integration tests are included in the tree and skip unless `FIRESTORE_EMULATOR_HOST` is set. Use `npm run test:emulator` on a machine with Java installed to run the Firestore-backed progress transaction tests.

Frontend:

```bash
cd web
npm run dev
npm run build
npm run build:prod
npm run test:components
npm run test:coverage
npm run test:e2e
npm run smoke:prod
npm run smoke:prod:local
npm run preview
```

`npm run build` is fine for local checks and CI, but it does not load `web/.env.production`. Use `npm run build:prod` before Firebase Hosting deploy so `VITE_FIREBASE_*` and `VITE_API_BASE_URL` are embedded in the bundle. A hosting release built without production env values will load the app shell but show `Missing Firebase config` on `/login`.

`npm run test:coverage` runs the Vitest component/page suite with V8 coverage and enforced thresholds for the currently covered UI surfaces. `npm run test:e2e` runs the signed-in critical flow plus deterministic Playwright coverage for responsive shell accessibility, Continue Watching gap resolution, season batch progress writes, failed/offline progress-write recovery, duplicate-action prevention during pending writes, concurrent browser progress consistency, and per-section failure/recovery (watchlist vs profile, history vs stats).

`npm run smoke:prod` runs an opt-in deployed runtime validation against Firebase Auth and the deployed API. It requires `EPISODERA_FIREBASE_API_KEY` or `VITE_FIREBASE_API_KEY`, `EPISODERA_SMOKE_EMAIL`, and `EPISODERA_SMOKE_PASSWORD`; optionally set `EPISODERA_PROD_API_BASE_URL`, `EPISODERA_SMOKE_SHOW_ID`, and `EPISODERA_SMOKE_ALLOWED_ORIGIN`. The script validates the signed-in happy path, then negative deployed checks for invalid auth (`401`), CORS rejection (`403`), and public read rate limiting (`429`) unless skipped via env flags. Use a dedicated automation account because the script updates profile data, adds/removes one watchlist item, and marks/unmarks S1 E1 for the smoke show.

Copy `web/.env.smoke.example` to `web/.env.smoke`, replace the placeholder values, then run `npm run smoke:prod:local`.

Hosted smoke: configure repository secrets `EPISODERA_FIREBASE_API_KEY`, `EPISODERA_SMOKE_EMAIL`, and `EPISODERA_SMOKE_PASSWORD`, then run the `Production Smoke` workflow from GitHub Actions. See `docs/Deployment.md` for evidence retention and optional environment approval gates.

## Deployment

Set the Firebase project:

```bash
firebase use episodera
```

Set the TMDb secret:

```bash
firebase functions:secrets:set TMDB_API_KEY
```

Deploy backend and Firestore:

```bash
firebase deploy --only functions
firebase deploy --only firestore
```

Deploy Firebase Hosting:

```bash
cd web
cp .env.production.example .env.production
# Fill Firebase web app config and the deployed API URL once on this machine.
npm run build:prod
cd ..
firebase deploy --only hosting
```

`npm run build:prod` validates `web/.env.production` before building. Required production values:

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Optional but recommended:

- `VITE_FIREBASE_MEASUREMENT_ID`

See `docs/Deployment.md` for the full pre-deploy checklist.

## Known Gaps

- Reconfirm the latest GitHub Actions CI run passes Firestore emulator progress and rules tests with `npm run test:emulator` after significant backend changes.
- Local Firestore emulator execution still requires Java and the Firebase Emulator Suite.
- TMDb detail, season, and trending responses use an in-memory TTL cache inside the Functions runtime. A persistent shared cache is still a possible future optimization.
- TMDb images and metadata must retain visible app attribution, including the official TMDB logo and: "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
- Backend and frontend coverage enforcement is now configured for the current automated test surfaces. Playwright covers the signed-in critical flow, responsive/accessibility smoke, previous-episode gap resolution, season batch writes, failed/offline progress-write recovery, duplicate-action prevention during pending writes, and concurrent browser progress consistency. Broader full-app frontend coverage and deeper accessibility automation are still pending.
- Deployed production smoke is available locally (`npm run smoke:prod:local`) and in GitHub Actions (`Production Smoke` workflow). Hosted runs require protected repository secrets and recorded workflow evidence for release candidates.
- Production deployment must configure `CORS_ORIGINS` for the Firebase Hosting, staging, and production domains.
- Rate limiting is implemented with per-Functions-instance in-memory buckets for public reads and authenticated writes. App Check Phase 1 client integration attaches `X-Firebase-AppCheck` when `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` is configured; backend enforcement remains Phase 2+. See `docs/AppCheck.md`.
- Dependency audit findings are documented in `docs/DependencyAudit.md`; fixes require semver-major upgrades for Firebase Functions packages and Vite tooling.
- Production beta readiness still needs runtime validation and an explicit dependency-risk decision.
- Firebase Crashlytics is not available for the current web-only client; add it when native Apple, Android, Flutter, or Unity clients exist.
- Mobile apps are not implemented yet; the current MVP client is web-first.

## Documentation

- `docs/Architecture.md` explains the system structure.
- `docs/API.md` defines backend contracts.
- `docs/Firestore.md` defines Firestore documents and ownership rules.
- `docs/Authentication.md` explains auth flow.
- `docs/AppCheck.md` defines the App Check rollout plan.
- `docs/FirebaseProject.md` records project verification and live endpoint checks.
- `docs/Navigation.md` describes screen structure and URL routes.
- `docs/CodingStandard.md` records implementation conventions.
- `docs/DependencyAudit.md` records current audit findings and upgrade plan.
- `docs/Deployment.md` covers deployment and CI.
- `docs/ResourceAlignment.md` records GitHub, Notion, Figma, and Canva source-of-truth rules.
