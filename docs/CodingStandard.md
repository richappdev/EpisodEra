# Coding Standard

Episodera is a TypeScript/Firebase project with a React web frontend. Keep changes small, typed, and aligned to the current `functions/` and `web/` root-level package structure.

## Scope Rules

- Build MVP features before v1.5/v2 features.
- Keep TMDb as the metadata source of truth.
- Store only user-owned app state in Firestore.
- Do not add Trakt, JustWatch, IMDb, notifications, analytics, or social features until the MVP tracking loop is stable.
- Prefer extending existing services, models, and routes over adding new architectural layers.

## Repository Layout

```text
docs/       Product and technical documentation
functions/ Firebase Functions API
web/        React/Vite frontend
```

Do not migrate to `apps/` or `backend/` unless the project explicitly decides to change layout.

## TypeScript

- Use strict TypeScript types for request and response models.
- Keep shared concepts mirrored between backend and frontend types when the API returns the same shape.
- Avoid `any`; use `unknown` at boundaries and validate before use.
- Prefer explicit interfaces for persisted Firestore documents and public API responses.
- Keep helper functions near the service or mapper that owns the behavior.
- Use ASCII in source and docs unless a file already clearly uses non-ASCII content.

## Backend

Backend code lives under `functions/src`.

Route conventions:
- Keep Express route files thin.
- Parse route params and request bodies before calling services.
- Use `HttpError` for expected client/provider failures.
- Return JSON envelopes consistently for list endpoints, such as `{ "items": [...] }`.
- Protect user-owned endpoints with `requireAuth`.
- Keep read-only TMDb discovery endpoints available without auth unless a product reason changes that.

Service conventions:
- Put Firestore reads/writes in service modules.
- Validate input in parser helpers before writing to Firestore.
- Use deterministic document IDs for user-owned media state:
  - watchlist: `{mediaType}_{tmdbId}`
  - progress: `{tmdbId}`
  - watched episode: `s01e01`
  - history: `movie_{tmdbId}` or `tv_{tmdbId}_{episodeKey}`
- Prefer small in-memory sorting for per-user/per-show collections when it avoids unnecessary composite indexes.

TMDb integration:
- Normalize TMDb responses in mapper functions before returning API responses.
- Return full image URLs, not raw TMDb paths, to the frontend.
- Keep frontend independent from TMDb-specific field names.

## Firestore

- User-owned data belongs under `users/{userId}/...`.
- Security rules must remain owner-scoped by default.
- Document new collections in `docs/Firestore.md` before or alongside implementation.
- Add composite indexes only when a screen or API requires a query Firestore cannot serve.
- Backend services should enforce document shape and canonical enum values.

Current canonical watchlist statuses:

```text
planned
watching
completed
dropped
```

## Frontend

Frontend code lives under `web/src`.

Component conventions:
- Keep pages in `web/src/pages`.
- Keep shared display components in `web/src/components`.
- Keep API calls in `web/src/api/client.ts`.
- Keep domain types in `web/src/types`.
- Pass typed callbacks into pages; avoid pages importing auth or global state directly when `App.tsx` can coordinate.

State conventions:
- Signed-in user-owned data should be cleared on sign-out.
- Loading, empty, unauthenticated, and error states are required for user-owned views.
- After mutations, update local state and refresh derived stats/history where needed.

UI conventions:
- Keep the app UI work-focused and scannable.
- Reuse existing colors, spacing, border radii, and list/card patterns.
- Use lucide-react icons when an icon improves recognition.
- Keep cards for repeated items or panels only; avoid nested cards.
- Ensure mobile layouts collapse into stable single-column sections.

## API Client

- Keep `request<T>()` as the single fetch wrapper.
- Attach Firebase ID tokens through `setApiTokenProvider`.
- Encode user input in URL query strings.
- Keep method names action-oriented, such as `listWatchlist`, `markEpisodeWatched`, and `meStats`.

## Documentation

Update docs in the same change when behavior changes:

- `docs/API.md` for endpoint contracts.
- `docs/Firestore.md` for schema, rules, and indexes.
- `docs/Navigation.md` for screen or route changes.
- `docs/Deployment.md` for build, CI, emulator, or deploy changes.
- `docs/Architecture.md` for meaningful system-level decisions.

## Verification

Before committing implementation changes, run the relevant checks:

```text
functions: npm test
web: npm run build
```

For docs-only changes, run:

```text
git diff --check
```

Baseline CI runs the functions and web build checks on pull requests and pushes to `main`.

## Known Gaps

- `functions` has an ESLint script, but ESLint 9 requires a flat config before lint can run in CI.
- Full signed-in Firestore emulator validation is pending until Java or another emulator-capable environment is available locally.
- Dependency audit review is still required before production deployment.
