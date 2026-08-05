# Architecture

> **Status:** Active
> **Authority:** Current runtime topology and repository layering
> **Owner role:** Engineering
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [System Architecture & Runtime Topology](https://app.notion.com/p/3aaa4181b62881ab9378ee7bfe9cd532)
> **Supersedes:** The Firebase-only architecture description

Episodera uses React/Vite and Kotlin/Compose clients, Firebase Auth, a TypeScript Express API on Firebase Functions, Supabase Postgres as the product database of record, and TMDb as the media metadata provider.

## Runtime Topology

```text
React/Vite web + Kotlin/Compose Android
            │
            │ Firebase ID token + App Check
            ▼
Firebase Functions v2 / Express API
            ├── Supabase service role → Postgres product data
            ├── Firebase Admin → Auth and retained rollback/legacy tooling
            └── TMDb API → canonical media metadata

Firebase Hosting → web delivery
Firebase Analytics/Performance/Crashlytics → monitoring
```

Production Steps A/B/C are documented complete: mapped product domains read and write through Supabase, and Firestore persistence is disabled. Firebase Auth, Functions/API runtime, Hosting, App Check, monitoring, and scheduled jobs remain active.

## Localized web delivery

Web routes use `/en-us` and `/zh-tw` prefixes. The route prefix determines UI and TMDb metadata language; the user setting stores only the preferred default used by bare and legacy URLs. Fixed public routes receive generated localized HTML shells. Dynamic movie, TV, franchise, and list requests are rewritten to the Firebase `web` function, which injects canonical, `hreflang`, Open Graph, and Twitter metadata before the Vite SPA boots. Private and resolver shells default to `noindex`.

## Current Structure

```text
.
├── docs/
│   ├── API.md
│   ├── Architecture.md
│   └── Firestore.md
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── api/
│       ├── config/
│       ├── integrations/
│       ├── lib/
│       ├── middleware/
│       ├── models/
│       └── services/
├── firebase.json
├── firestore.indexes.json
└── firestore.rules
```

## Backend Layers

`api`

Express routes and HTTP validation. Route handlers should stay thin and delegate external calls or persistence to services.

`services`

Application-facing service objects combine authenticated identity, Supabase-primary persistence, retained Firestore rollback paths, and TMDb behavior.

`integrations`

External API clients and mappers. TMDb raw response types live here so third-party payload shape does not leak into frontend contracts.

`models`

Normalized app models returned by the API.

`middleware`

Cross-route Express concerns such as Firebase Auth token parsing.

## Request Flow

```text
Client
  -> Firebase HTTPS Function api
  -> Express middleware
  -> Route handler
  -> Service
  -> TMDb client
  -> Normalized JSON response
```

## Configuration

TMDb credentials are read from Firebase secret `TMDB_API_KEY`.

Set it with:

```bash
firebase functions:secrets:set TMDB_API_KEY
```

For local development, copy `.env.example` to `.env` and provide a TMDb API key before starting emulators.

## Scheduled jobs

| Function | Schedule | Time zone | Role |
|---|---|---|---|
| `publishScheduledPuzzle` | `1 0 * * *` | UTC | Publish due `scheduled` daily puzzles |
| `autoCreateDailyPuzzle` | `0 6 * * *` | Asia/Taipei | Create a published puzzle for the Taipei calendar date when none exists |

`autoCreateDailyPuzzle` requires `TMDB_API_KEY`. Player `GET /puzzles/today` still resolves “today” via UTC `puzzleDate`.

## API Design

The initial API is read-only:

- `GET /health`
- `GET /search?q=<query>&page=<page>`
- `GET /trending?page=<page>`
- `GET /movie/:id`
- `GET /tv/:id`

Search and trending return separate movie and TV result pages. Detail endpoints return one normalized `MediaDetail`.

## Frontend Direction

Recommended first frontend screens:

- Trending screen with movie/TV sections.
- Search screen with debounced query input.
- Movie detail screen.
- TV detail screen.
- Auth entry point.
- Watchlist screen once write endpoints exist.

Keep frontend contracts aligned with `docs/API.md` rather than raw TMDb responses.
