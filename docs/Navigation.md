# Navigation

## Current navigation model

The MVP uses client-side view state in `web/src/App.tsx` instead of a URL router. Top-level views are selected through the top bar; media detail is an overlay state layered on top of the current discovery view.

## Current screens and experiences

| Experience | Entry | Implementation form | Data source | Auth |
| --- | --- | --- | --- | --- |
| Account loading | App bootstrap | Application state | Firebase Auth | Optional |
| Auth | Sign in / Create account from top bar | `AuthPage` view | Firebase Auth | Optional for browsing |
| Trending | Default view; TV Shows tab selected first | `DiscoveryPage` top-level view | `GET /trending/tv` or `GET /trending/movie` | Public |
| Search | Top-bar tab | `DiscoveryPage` top-level view | `GET /search?q=` | Public |
| Movie detail | Media card | Detail overlay state | `GET /movie/:id` | Public |
| TV detail | Media card | Detail overlay state | `GET /tv/:id` | Public |
| Season and episode progress | TV detail | Embedded in `DetailPage` | `GET /tv/:id/season/:seasonNumber`, `GET/POST/DELETE /progress/:showId` | Required for writes |
| Watchlist | Top bar | `WatchlistPage` top-level view | `GET /watchlist`, `GET /progress` | Required |
| Continue Watching | Watchlist section | Section within `WatchlistPage` | `GET /progress` | Required |
| Profile, statistics, and history | Top bar | `ProfilePage` top-level view | `GET /me/profile`, `GET /me/stats`, `GET /me/history` | Required |
| Settings | Top bar | `SettingsPage` top-level view | `localStorage` + `GET/PATCH /me/settings` when signed in | Optional |

## Routing debt

The following remain planned architecture work rather than missing screens:

- URL routes and deep links for detail pages and top-level views
- Browser back/forward integration
- Shareable media detail URLs

Recommended future routes:

```plain text
/
/search
/movie/:id
/tv/:id
/tv/:id/season/:seasonNumber
/watchlist
/continue-watching
/profile
/settings
/login
/signup
```

## State rules

- Trending remains the default first screen.
- Trending uses TV Shows and Movies tabs. TV Shows is always the first-load default.
- Language support is limited to English (`en-US`) and Traditional Chinese (`zh-TW`) for MVP.
- Search keeps the last query while switching between top-level discovery tabs.
- Detail view should preserve the previous discovery state when navigating back.
- Auth should return the user to the previous app view after success.
- Signed-in initial loading uses `Promise.allSettled` so one failed domain request does not block unrelated sections.

## Router migration trigger

Add React Router when at least two of these are true:

- Deep links are needed for media detail pages.
- Browser history support is required for top-level views.
- Shareable URLs are required for beta or release.
- Independent route-based analytics is needed.

Watchlist, profile, season detail, and Continue Watching are already implemented as client-state views. Router adoption is now primarily a product-polish and release-readiness decision, not a missing-screen blocker.
