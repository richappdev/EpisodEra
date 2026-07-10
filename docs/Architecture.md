# Architecture

The project starts as a Firebase-backed TV and movie discovery app. The backend is a TypeScript Firebase Functions API that normalizes TMDb responses for future frontend screens.

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

Application-facing service objects. This layer gives future watchlist/rating endpoints a place to combine Auth, Firestore, and TMDb behavior.

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
