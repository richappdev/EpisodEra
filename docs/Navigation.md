# Navigation

## Current navigation model

The MVP uses **React Router 6** (`react-router-dom`) with browser history and shareable URLs. Top-level screens are route-driven; movie and TV detail pages have dedicated paths with optional season deep links.

## Route map

| Route | Screen | Auth | Canvas | Notes |
| --- | --- | --- | --- | --- |
| `/` | Home / Trending (TV Shows tab default) + Continue Watching when signed in | Public | cinema | CW poster rail is first band; discovery below fold |
| `/landing` | Marketing introduction | Public | cinema | Product TopBar hidden; CTAs to `/signup`, `/login`, `/` |
| `/search` | Search | Public | cinema | Empty prompt when no `q` query param |
| `/search?q={query}` | Search results | Public | cinema | Query persists in the URL |
| `/movie/:id` | Movie detail | Public | cinema | Full-bleed hero + status rail |
| `/tv/:id` | TV detail | Public | cinema | Default season selected from show metadata |
| `/tv/:id/season/:seasonNumber` | TV detail + season | Public | cinema | Shareable season deep link |
| `/watchlist` | Collection Active + Library tabs | Required for data | cinema | Continue Watching lives on Home |
| `/continue-watching` | Redirect to `/#continue-watching` | Required for data | cinema | Alias for Home Continue Watching |
| `/timeline` | Personal viewing timeline | Required for data | cinema | Day/month/year diary spine |
| `/franchises` | Franchise catalog | Public | cinema | Curated universes |
| `/franchises/:slug` | Franchise progress | Public catalog; auth for progress | cinema | Release / chronological order |
| `/list/:listId` | Discovery list (full grid) | Public; franchise continuation richer when signed in | cinema | Opened from Home rail **More** |
| `/social` | Friends, feed, challenges | Required for data | cinema | Friend codes + compatibility |
| `/profile` | Profile, statistics, history, Year Recap | Required for data | cinema | Quiet figures; Year Recap band |
| `/settings` | Settings | Optional | cinema | Language, providers, privacy/social toggles, TV Time import, personal export, account deletion |
| `/privacy` | Privacy policy | Public | cinema | Static legal content |
| `/login` | Sign in | Public | cinema | Cinematic auth panel |
| `/signup` | Sign up | Public | cinema | Cinematic auth panel |

Unknown paths redirect to `/`.

## Screen inventory

| Experience | Route(s) | Implementation | Data source |
| --- | --- | --- | --- |
| Account loading | App bootstrap | Application state | Firebase Auth |
| Auth | `/login`, `/signup` | `AuthPage` | Firebase Auth |
| Landing | `/landing` | `LandingPage` | Static copy + public trending posters |
| Trending / Home | `/` | `DiscoveryPage` | `GET /trending/tv` or `GET /trending/movie`, `GET /discover/suggestions` |
| Discovery list | `/list/:listId` | `ListPage` via `ListRoute` | `GET /discover/lists/:listId` |
| Search | `/search`, `/search?q=` | `DiscoveryPage` | `GET /search?q=` |
| Franchises | `/franchises`, `/franchises/:slug` | `FranchiseListPage` / `FranchiseDetailPage` | `GET /franchises`, `GET /me/franchises/:slug/progress` |
| Movie detail | `/movie/:id` | `DetailPage` via `MediaDetailRoute` | `GET /movie/:id` |
| TV detail | `/tv/:id`, `/tv/:id/season/:seasonNumber` | `DetailPage` via `MediaDetailRoute` | `GET /tv/:id`, `GET /tv/:id/season/:seasonNumber` |
| Episode progress | TV detail routes | Embedded in `DetailPage` | Progress APIs |
| Collection | `/watchlist` | `WatchlistPage` (Active / Library tabs) | `GET /watchlist`, `GET /progress` |
| Continue Watching | `/#continue-watching`, `/continue-watching` | Section within `DiscoveryPage` (Home) | `GET /progress` (+ watchlist for grouping) |
| Timeline | `/timeline` | `TimelinePage` | `GET /me/history` |
| Profile | `/profile` | `ProfilePage` | `GET /me/profile`, `GET /me/stats`, `GET /me/recap`, `GET /me/achievements`, `GET /me/history` |
| Social | `/social` | `SocialPage` | `GET /me/friends`, `GET /me/feed`, `GET /me/challenges`, compatibility |
| Settings | `/settings` | `SettingsPage` | `localStorage` + `GET/PATCH /me/settings`, import/export, `DELETE /me/account` when signed in |
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
- Keep Figma Cinema Memory frames synced using [`docs/CinemaMemoryDesign.md`](./CinemaMemoryDesign.md) (single cinema canvas on all routes)
- Optional query-driven trending tab selection (for example `/?tab=movies`)
