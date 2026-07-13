# Navigation

## Current navigation model

The MVP uses **React Router 6** (`react-router-dom`) with browser history and shareable URLs. Top-level screens are route-driven; movie and TV detail pages have dedicated paths with optional season deep links.

## Route map

| Route | Screen | Auth | Notes |
| --- | --- | --- | --- |
| `/` | Trending (TV Shows tab default) | Public | Default landing |
| `/search` | Search | Public | Empty prompt when no `q` query param |
| `/search?q={query}` | Search results | Public | Query persists in the URL |
| `/movie/:id` | Movie detail | Public | Shareable movie URL |
| `/tv/:id` | TV detail | Public | Default season selected from show metadata |
| `/tv/:id/season/:seasonNumber` | TV detail + season | Public | Shareable season deep link |
| `/watchlist` | Watchlist + Continue Watching section | Required for data | |
| `/continue-watching` | Redirect to `/watchlist#continue-watching` | Required for data | Alias for the embedded section |
| `/profile` | Profile, statistics, history | Required for data | |
| `/settings` | Settings | Optional | Language, preferences, privacy link, account deletion |
| `/privacy` | Privacy policy | Public | Static legal content |
| `/login` | Sign in | Public | Returns to prior route after success when available |
| `/signup` | Sign up | Public | Returns to prior route after success when available |

Unknown paths redirect to `/`.

## Screen inventory

| Experience | Route(s) | Implementation | Data source |
| --- | --- | --- | --- |
| Account loading | App bootstrap | Application state | Firebase Auth |
| Auth | `/login`, `/signup` | `AuthPage` | Firebase Auth |
| Trending | `/` | `DiscoveryPage` | `GET /trending/tv` or `GET /trending/movie` |
| Search | `/search`, `/search?q=` | `DiscoveryPage` | `GET /search?q=` |
| Movie detail | `/movie/:id` | `DetailPage` via `MediaDetailRoute` | `GET /movie/:id` |
| TV detail | `/tv/:id`, `/tv/:id/season/:seasonNumber` | `DetailPage` via `MediaDetailRoute` | `GET /tv/:id`, `GET /tv/:id/season/:seasonNumber` |
| Episode progress | TV detail routes | Embedded in `DetailPage` | Progress APIs |
| Watchlist | `/watchlist` | `WatchlistPage` | `GET /watchlist`, `GET /progress` |
| Continue Watching | `/watchlist#continue-watching`, `/continue-watching` | Section within `WatchlistPage` | `GET /progress` |
| Profile | `/profile` | `ProfilePage` | `GET /me/profile`, `GET /me/stats`, `GET /me/history` |
| Settings | `/settings` | `SettingsPage` | `localStorage` + `GET/PATCH /me/settings`, `DELETE /me/account` when signed in |
| Privacy policy | `/privacy` | `PrivacyPage` | Static copy in `web/src/types/legal.ts` |

## State rules

- Trending remains the default first screen at `/`.
- Trending uses TV Shows and Movies tabs. TV Shows is always the first-load default.
- Language support is limited to English (`en-US`) and Traditional Chinese (`zh-TW`) for MVP.
- Search query persists in the URL via `?q=` while navigating within the app.
- Detail routes preserve the originating nav highlight through router location state (`nav`).
- Browser back from detail uses history (`navigate(-1)`).
- Auth returns the user to the previous route after success when `location.state.from` is present.
- Signed-in initial loading uses `Promise.allSettled` so one failed domain request does not block unrelated sections.

## Implementation files

- `web/src/main.tsx` — `BrowserRouter` wrapper
- `web/src/routes/paths.ts` — canonical path helpers
- `web/src/routes/AppRoutes.tsx` — route table
- `web/src/routes/DetailRoute.tsx` — movie/TV detail loading from URL params
- `web/src/routes/DiscoveryRoute.tsx` — trending/search route wrapper
- `web/src/routes/AuthRoute.tsx` — login/signup route wrapper
- `web/src/AppContext.tsx` — shared app data and navigation helpers
- `web/src/components/TopBar.tsx` — primary `NavLink` navigation

## Hosting

Firebase Hosting already rewrites unknown paths to `/index.html`, so direct loads of `/tv/:id`, `/search`, and other MVP routes work in production.

## Remaining polish

- Optional dedicated analytics mapping per canonical route segment
- Broader Playwright coverage for direct URL loads and browser back/forward
- Optional query-driven trending tab selection (for example `/?tab=movies`)
