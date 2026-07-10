# Navigation

## Current web routes

The MVP currently uses client state instead of a router. This is acceptable until watchlist and profile screens are added.

## Current screens

| Screen | Entry | Data source | Auth |
| --- | --- | --- | --- |
| Auth | Signed-out action from top bar | Firebase Auth | Optional for browsing |
| Trending | Default view | `GET /trending` | Public |
| Search | Top-bar tab | `GET /search?q=` | Public |
| Movie Detail | Media card | `GET /movie/:id` | Public |
| TV Detail | Media card | `GET /tv/:id` | Public |

## Next screens

| Screen | Entry | Data source | Auth |
| --- | --- | --- | --- |
| Watchlist | Top bar | `GET /watchlist` | Required |
| Profile | Top bar | Firebase user + `GET /me/stats` | Required |
| Season Detail | TV detail | `GET /tv/:id/season/:seasonNumber` | Public |
| Continue Watching | Home/Profile | `GET /me/stats` or progress endpoint | Required |

## State rules

- Trending remains the default first screen.
- Search keeps the last query while switching between top-level discovery tabs.
- Detail view should preserve the previous discovery state when navigating back.
- Auth modal/page should return the user to the previous app view after success.

## Router migration trigger

Add React Router when at least two of these are true:

- Watchlist is implemented.
- Profile/stats is implemented.
- Season detail is implemented.
- Deep links are needed for media detail pages.
