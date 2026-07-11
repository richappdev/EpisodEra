# Episodera

Episodera is a movie and TV tracking app for discovering titles, saving a watchlist, tracking episode progress, and reviewing profile stats. The current MVP is a React/Vite web app backed by Firebase Auth, Firestore, Firebase Functions, and TMDb metadata.

## Current Status

The project is in MVP hardening. Core web features are implemented, progress-tracking reliability fixes are in place, and GitHub Actions is configured to run Java-backed Firestore emulator tests. The remaining work is broader automated tests, dependency upgrade planning, first hosted CI emulator-run confirmation, and production-readiness decisions.

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
- GitHub Actions CI for backend build, backend lint, backend unit tests, Java-backed Firestore emulator tests, and frontend build.
- Project documentation for architecture, API contracts, Firestore schema, auth, navigation, deployment, coding standards, and dependency audit posture.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Firebase Web SDK
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
│   └── Navigation.md
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
- `web/.env` from `web/.env.example` for Vite and Firebase web values.
- Firebase secret `TMDB_API_KEY` for deployed functions.
- Optional `CORS_ORIGINS` comma-separated allowlist for deployed API origins. Leave unset only for local development.

For local emulator development, Java is required by the Firestore emulator.

## Development Commands

Backend:

```bash
cd functions
npm run build
npm run lint
npm test
npm run test:emulator
npm run serve
```

`npm test` builds the functions TypeScript and runs Node test files emitted into `lib/`. Firestore emulator integration tests are included in the tree and skip unless `FIRESTORE_EMULATOR_HOST` is set. Use `npm run test:emulator` on a machine with Java installed to run the Firestore-backed progress transaction tests.

Frontend:

```bash
cd web
npm run dev
npm run build
npm run preview
```

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

See `docs/Deployment.md` for the full pre-deploy checklist.

## Known Gaps

- Confirm the first GitHub Actions run passes Firestore emulator progress and rules tests with `npm run test:emulator`.
- Local Firestore emulator execution still requires Java and the Firebase Emulator Suite.
- TMDb detail, season, and trending responses use an in-memory TTL cache inside the Functions runtime. A persistent shared cache is still a possible future optimization.
- Frontend component tests and a signed-in Playwright critical flow are still pending.
- Production deployment must configure `CORS_ORIGINS` for the Firebase Hosting, staging, and production domains.
- Dependency audit findings are documented in `docs/DependencyAudit.md`; fixes require semver-major upgrades for Firebase Functions packages and Vite tooling.
- Production beta readiness still needs runtime validation and an explicit dependency-risk decision.
- Firebase Crashlytics is not available for the current web-only client; add it when native Apple, Android, Flutter, or Unity clients exist.
- Mobile apps are not implemented yet; the current MVP client is web-first.

## Documentation

- `docs/Architecture.md` explains the system structure.
- `docs/API.md` defines backend contracts.
- `docs/Firestore.md` defines Firestore documents and ownership rules.
- `docs/Authentication.md` explains auth flow.
- `docs/Navigation.md` describes screen structure.
- `docs/CodingStandard.md` records implementation conventions.
- `docs/DependencyAudit.md` records current audit findings and upgrade plan.
- `docs/Deployment.md` covers deployment and CI.
