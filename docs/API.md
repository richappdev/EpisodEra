# API

The backend exposes a single Firebase HTTPS Function named `api`. In local emulators the base URL is:

```text
http://127.0.0.1:5001/<firebase-project-id>/us-central1/api
```

The deployed Cloud Functions URL normally has this form:

```text
https://us-central1-<firebase-project-id>.cloudfunctions.net/api
```

Responses are JSON except for successful `DELETE /watchlist/:itemId` and `DELETE /me/account`, which return an empty `204 No Content` response. Send JSON request bodies with `Content-Type: application/json`; the request body limit is 256 KiB (supports chunked TV Time import staging).

Read-only discovery endpoints can be called without authentication. User-owned endpoints require a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

Missing, malformed, expired, and otherwise invalid tokens all produce the same `401 unauthenticated` response on protected routes. Public routes ignore invalid bearer tokens.

Requests that pass CORS processing receive an `x-request-id` response header. If the request supplies an `x-request-id` header, the API echoes it; otherwise the API generates a UUID. This identifier is also included in the structured server log for the request.

Set `CORS_ORIGINS` to a comma-separated allowlist for deployed environments. When omitted, the API allows all origins for local development.

TMDb detail and TV season reads use a 24-hour per-Functions-instance in-memory TTL cache. Trending reads use a 5-minute cache. Search requests are not cached. Cache entries are local to one warm Functions instance and are not shared across instances.

## Endpoint summary

| Method | Path | Authentication | Success |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | `200` |
| `GET` | `/search` | Public | `200` |
| `GET` | `/trending` | Public | `200` |
| `GET` | `/trending/movie` | Public | `200` |
| `GET` | `/trending/tv` | Public | `200` |
| `GET` | `/trending/shows` | Public | `200` |
| `GET` | `/movie/:id` | Public | `200` |
| `GET` | `/tv/:id` | Public | `200` |
| `GET` | `/tv/:id/season/:seasonNumber` | Public | `200` |
| `GET` | `/watchlist` | Firebase ID token | `200` |
| `POST` | `/watchlist` | Firebase ID token | `201` |
| `PATCH` | `/watchlist/:itemId/status` | Firebase ID token | `200` |
| `DELETE` | `/watchlist/:itemId` | Firebase ID token | `204` |
| `GET` | `/progress` | Firebase ID token | `200` |
| `GET` | `/progress/:showId` | Firebase ID token | `200` |
| `POST` | `/progress/:showId/episode` | Firebase ID token | `201` |
| `POST` | `/progress/:showId/episodes/batch` | Firebase ID token | `200` |
| `DELETE` | `/progress/:showId/episode/:episodeKey` | Firebase ID token | `200` |
| `GET` | `/me/stats` | Firebase ID token | `200` |
| `GET` | `/me/recap` | Firebase ID token | `200` |
| `GET` | `/me/achievements` | Firebase ID token | `200` |
| `GET` | `/me/friends` | Firebase ID token | `200` |
| `POST` | `/me/friends/request` | Firebase ID token | `201` |
| `PATCH` | `/me/friends/:friendUserId` | Firebase ID token | `200` |
| `GET` | `/me/feed` | Firebase ID token | `200` |
| `GET` | `/me/friends/:friendUserId/compatibility` | Firebase ID token | `200` |
| `GET` | `/me/challenges` | Firebase ID token | `200` |
| `GET` | `/discussions/:mediaType/:id` | Optional | `200` |
| `POST` | `/discussions/:mediaType/:id` | Firebase ID token | `201` |
| `GET` | `/me/franchises/:slug/progress` | Firebase ID token | `200` |
| `GET` | `/franchises` | Optional | `200` |
| `GET` | `/franchises/:slug` | Optional | `200` |
| `GET` | `/discover/suggestions` | Optional | `200` |
| `GET` | `/me/history` | Firebase ID token | `200` |
| `GET` | `/me/profile` | Firebase ID token | `200` |
| `PATCH` | `/me/profile` | Firebase ID token | `200` |
| `GET` | `/me/settings` | Firebase ID token | `200` |
| `PATCH` | `/me/settings` | Firebase ID token | `200` |
| `DELETE` | `/me/account` | Firebase ID token | `204` |

## Rate limiting

The API applies per-Functions-instance rate limits before route handlers run:

| Bucket | Scope | Default |
| --- | --- | --- |
| Public reads | Client IP for `GET /search`, `GET /trending*`, `GET /movie/:id`, `GET /tv/:id`, `GET /tv/:id/season/:seasonNumber`, `GET /franchises*`, and `GET /discover*` | 120 requests per 60 seconds |
| Authenticated writes | Firebase UID for `POST`, `PATCH`, and `DELETE` requests under `/watchlist`, `/progress`, `/me/profile`, `/me/settings`, `/me/account`, `/me/friends`, and `/discussions` | 60 requests per 60 seconds |

Configure defaults with:

```text
PUBLIC_READ_RATE_LIMIT_MAX=120
PUBLIC_READ_RATE_LIMIT_WINDOW_MS=60000
AUTH_WRITE_RATE_LIMIT_MAX=60
AUTH_WRITE_RATE_LIMIT_WINDOW_MS=60000
```

Rate-limited responses use HTTP `429`:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Please retry later."
  }
}
```

Responses include `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers when a route is covered by a bucket. `x-ratelimit-reset` is a Unix timestamp in seconds. Limits are maintained in memory per Functions instance, so they are not a deployment-wide quota.

## Language

TMDb-backed read endpoints accept an optional `language` query parameter. MVP supported values are:

```text
en-US
zh-TW
```

Unsupported or missing values fall back to `en-US`. Stable app identity still uses TMDb IDs and media type, not localized titles.

## Health

```http
GET /health
```

Response:

```json
{
  "ok": true
}
```

## Search

```http
GET /search?q=severance&page=1&language=en-US
```

Parameters:

| Name | Required | Description |
| --- | --- | --- |
| `q` | Yes | Search query text. |
| `page` | No | Positive integer page number. Missing or invalid values fall back to `1`. |
| `language` | No | `en-US` or `zh-TW`. Defaults to `en-US`. |

Response:

```json
{
  "movies": {
    "page": 1,
    "totalPages": 1,
    "totalResults": 1,
    "results": []
  },
  "tv": {
    "page": 1,
    "totalPages": 1,
    "totalResults": 1,
    "results": []
  }
}
```

Each result is normalized:

```json
{
  "id": 95396,
  "mediaType": "tv",
  "title": "Severance",
  "overview": "Mark leads a team of office workers...",
  "releaseDate": "2022-02-17",
  "voteAverage": 8.4,
  "popularity": 120.5,
  "images": {
    "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
    "backdrop": "https://image.tmdb.org/t/p/w780/example.jpg"
  }
}
```

## Trending

```http
GET /trending?page=1&language=en-US
```

Returns weekly trending movies and TV shows using the same paged shape as `/search`.

For a single media type, use:

```http
GET /trending/movie?page=1&language=en-US
GET /trending/tv?page=1&language=en-US
GET /trending/shows?page=1&language=en-US
```

`/trending/tv` and `/trending/shows` both return weekly trending TV shows from TMDb's `/trending/tv/week` endpoint.

## Movie Detail

```http
GET /movie/:id?language=en-US
```

Response:

```json
{
  "id": 550,
  "mediaType": "movie",
  "title": "Fight Club",
  "overview": "...",
  "releaseDate": "1999-10-15",
  "voteAverage": 8.4,
  "popularity": 80.1,
  "images": {
    "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
    "backdrop": "https://image.tmdb.org/t/p/w780/example.jpg"
  },
  "genres": [{ "id": 18, "name": "Drama" }],
  "runtimeMinutes": 139,
  "status": "Released",
  "originalLanguage": "en",
  "homepage": "https://www.example.com",
  "totalEpisodes": null,
  "seasons": []
}
```

## TV Detail

```http
GET /tv/:id?language=en-US
```

Uses the same base response shape as movie detail. `runtimeMinutes` is derived from the first TMDb `episode_run_time` value when available.

TV responses also include season metadata for episode-progress UI:

```json
{
  "totalEpisodes": 19,
  "seasons": [
    {
      "id": 3624,
      "seasonNumber": 1,
      "title": "Season 1",
      "episodeCount": 9,
      "airDate": "2022-02-17",
      "poster": "https://image.tmdb.org/t/p/w500/example.jpg"
    }
  ]
}
```

## TV Season Detail

```http
GET /tv/:id/season/:seasonNumber?language=en-US
```

Returns normalized TMDb season metadata and episode rows for a TV show.

Response:

```json
{
  "id": 3624,
  "tvId": 95396,
  "seasonNumber": 1,
  "title": "Season 1",
  "overview": "...",
  "airDate": "2022-02-17",
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "episodeCount": 9,
  "episodes": [
    {
      "id": 3520301,
      "episodeKey": "s01e01",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "title": "Good News About Hell",
      "overview": "...",
      "airDate": "2022-02-17",
      "runtimeMinutes": 57,
      "still": "https://image.tmdb.org/t/p/w300/example.jpg",
      "voteAverage": 8.1
    }
  ]
}
```

## Watchlist

Watchlist endpoints require authentication and read/write only the signed-in user's Firestore path:

```text
users/{uid}/watchlist/{itemId}
```

`itemId` is derived by the backend using:

```text
{mediaType}_{tmdbId}
```

Examples: `movie_550`, `tv_95396`.

Allowed TV `status` values:

```text
planned
watching
completed
dropped
```

Allowed movie `status` values:

```text
unwatched
watched
```

### List Watchlist

```http
GET /watchlist?page={page}&pageSize={pageSize}
```

Query parameters:

- `page` — optional positive integer, default `1`
- `pageSize` — optional positive integer, default `25`, maximum `100`

Response:

```json
{
  "items": [
    {
      "itemId": "tv_95396",
      "tmdbId": 95396,
      "mediaType": "tv",
      "title": "Severance",
      "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
      "backdrop": "https://image.tmdb.org/t/p/w780/example.jpg",
      "status": "planned",
      "addedAt": "2026-07-10T04:00:00.000Z",
      "updatedAt": "2026-07-10T04:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 25,
  "totalCount": 12,
  "hasMore": false
}
```

### Add To Watchlist

```http
POST /watchlist
```

Request:

```json
{
  "tmdbId": 95396,
  "mediaType": "tv",
  "title": "Severance",
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w780/example.jpg",
  "status": "planned"
}
```

`status`, `poster`, and `backdrop` are optional. TV status defaults to `planned`; movie status defaults to `unwatched`.

This operation is an upsert keyed by `{mediaType}_{tmdbId}`. Re-adding an existing item preserves `addedAt`, updates the supplied fields and `updatedAt`, and still returns `201 Created` with the saved watchlist item.

### Update Watchlist Status

```http
PATCH /watchlist/:itemId/status
```

Request:

```json
{
  "status": "watching"
}
```

Response: updated watchlist item.

### Remove From Watchlist

```http
DELETE /watchlist/:itemId
```

Response: `204 No Content`. Deleting a well-formed item ID is idempotent: a missing item also returns `204`.

## Episode Progress

Progress endpoints require authentication and read/write only the signed-in user's Firestore path:

```text
users/{uid}/progress/{showId}
users/{uid}/progress/{showId}/episodes/{episodeKey}
```

`showId` is the positive TMDb TV show ID. `episodeKey` is generated from season and episode numbers, such as `s01e01`.

### List Show Progress

```http
GET /progress?page={page}&pageSize={pageSize}
```

Lists summary-only show progress documents for the signed-in user, sorted by most recently updated. This endpoint does not read each show's `episodes` subcollection.

Query parameters:

- `page` — optional positive integer, default `1`
- `pageSize` — optional positive integer, default `25`, maximum `100`

Response:

```json
{
  "items": [
    {
      "showId": "95396",
      "tmdbId": 95396,
      "title": "Severance",
      "totalEpisodes": 19,
      "watchedEpisodeCount": 2,
      "progressPercent": 10.53,
      "currentSeason": 1,
      "currentEpisode": 2,
      "nextEpisode": {
        "episodeKey": "s01e03",
        "seasonNumber": 1,
        "episodeNumber": 3,
        "episodeTitle": "In Perpetuity"
      },
      "updatedAt": "2026-07-10T07:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 25,
  "totalCount": 5,
  "hasMore": false
}
```

### Get Show Progress

```http
GET /progress/:showId
```

Response when no progress exists yet:

```json
{
  "progress": null
}
```

Response after watched episodes exist:

```json
{
  "progress": {
    "showId": "95396",
    "tmdbId": 95396,
    "title": "Severance",
    "totalEpisodes": 19,
    "watchedEpisodeCount": 1,
    "progressPercent": 5.26,
    "currentSeason": 1,
    "currentEpisode": 1,
    "nextEpisode": {
      "episodeKey": "s01e02",
      "seasonNumber": 1,
      "episodeNumber": 2,
      "episodeTitle": "Half Loop"
    },
    "updatedAt": "2026-07-10T07:00:00.000Z",
    "episodes": [
      {
        "episodeKey": "s01e01",
        "seasonNumber": 1,
        "episodeNumber": 1,
        "episodeTitle": "Good News About Hell",
        "watched": true,
        "watchedAt": "2026-07-10T07:00:00.000Z",
        "updatedAt": "2026-07-10T07:00:00.000Z"
      }
    ]
  }
}
```

### Mark Episode Watched

```http
POST /progress/:showId/episode
```

Request:

```json
{
  "seasonNumber": 1,
  "episodeNumber": 1
}
```

The backend validates the show, season, and episode against TMDb and resolves the canonical show title, episode title, and total episode count. Response: `201 Created` with the `ShowProgress` object directly (without a `progress` wrapper). Re-marking the same episode is idempotent for counts and preserves the original `watchedAt` value.

### Batch Mark Episodes Watched Or Unwatched

```http
POST /progress/:showId/episodes/batch
```

Request:

```json
{
  "watched": true,
  "episodes": [
    {"seasonNumber": 1, "episodeNumber": 1},
    {"seasonNumber": 1, "episodeNumber": 2}
  ]
}
```

The input array must contain 1-100 entries. It is deduplicated by season/episode after the 100-entry limit is checked. The backend validates all requested episodes before writing, then updates episode rows, history entries, and the aggregate progress summary in one Firestore transaction.

Response: the updated `ShowProgress` object directly (without a `progress` wrapper).

### Mark Episode Unwatched

```http
DELETE /progress/:showId/episode/:episodeKey
```

Response:

```json
{
  "progress": {
    "showId": "95396",
    "tmdbId": 95396,
    "title": "Severance",
    "totalEpisodes": 19,
    "watchedEpisodeCount": 1,
    "progressPercent": 5.26,
    "currentSeason": 1,
    "currentEpisode": 2,
    "nextEpisode": {
      "episodeKey": "s01e01",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "episodeTitle": "Good News About Hell"
    },
    "updatedAt": "2026-07-10T07:00:00.000Z",
    "episodes": [
      {
        "episodeKey": "s01e02",
        "seasonNumber": 1,
        "episodeNumber": 2,
        "episodeTitle": "Half Loop",
        "watched": true,
        "watchedAt": "2026-07-10T07:00:00.000Z",
        "updatedAt": "2026-07-10T07:00:00.000Z"
      }
    ]
  }
}
```

Unlike the two progress `POST` endpoints, this response is wrapped in a `progress` property.

## Profile Stats

Stats endpoints require authentication. Aggregate counters still use watchlist and progress summaries; watch time, streaks, rankings, and genre insights are derived from history events (`genreNames` / `runtimeMinutes` when present, otherwise episode 42 min / movie 110 min defaults).

```http
GET /me/stats
```

Response:

```json
{
  "totalWatchedMovies": 4,
  "totalWatchedEpisodes": 23,
  "currentlyWatchingCount": 3,
  "completedShowsCount": 2,
  "watchlistCount": 12,
  "progressShowCount": 5,
  "totalWatchTimeMinutes": 1842,
  "longestStreakDays": 12,
  "currentStreakDays": 3,
  "topShows": [{"tmdbId": 95396, "mediaType": "tv", "title": "Severance", "count": 18}],
  "topMovies": [{"tmdbId": 550, "mediaType": "movie", "title": "Fight Club", "count": 1}],
  "topGenres": [{"name": "Drama", "count": 20}],
  "mostActiveMonth": "2026-07"
}
```

```http
GET /me/recap?year={year}
```

Query parameters:

- `year` — optional UTC calendar year; defaults to the current UTC year

Response:

```json
{
  "year": 2026,
  "totalWatchedMovies": 4,
  "totalWatchedEpisodes": 23,
  "totalWatchTimeMinutes": 1842,
  "longestStreakDays": 12,
  "mostActiveMonth": "2026-07",
  "topShow": {"tmdbId": 95396, "mediaType": "tv", "title": "Severance", "count": 18},
  "topMovie": {"tmdbId": 550, "mediaType": "movie", "title": "Fight Club", "count": 1},
  "topGenre": {"name": "Drama", "count": 20},
  "newlyDiscovered": [{"tmdbId": 95396, "mediaType": "tv", "title": "Severance", "count": 18}]
}
```

`newlyDiscovered` titles are those whose first watched event falls in the requested year.

## Social and Achievements

Friend connections, activity feed, taste compatibility, shared challenges, and opt-in achievements require authentication. Discussions are optionally authenticated so spoiler filtering can use watch history when signed in.

```http
GET /me/achievements
GET /me/friends
POST /me/friends/request
PATCH /me/friends/:friendUserId
GET /me/feed
GET /me/friends/:friendUserId/compatibility
GET /me/challenges?friendUserId={optionalFriendUserId}
GET /discussions/:mediaType/:id
POST /discussions/:mediaType/:id
```

`POST /me/friends/request` body:

```json
{"friendCode": "ABC123"}
```

Friend codes are six alphanumeric characters. `PATCH /me/friends/:friendUserId` accepts `status` of `accepted`, `declined`, or `removed`.

Discussion posts require the caller to have watched the title (movie or scoped episode) when they have spoiler protection enabled. List responses may set `spoilerHidden: true` and omit `body` until the viewer has watched the same scope.

Privacy-related settings fields:

```json
{
  "achievementsEnabled": true,
  "showAchievementsOnProfile": true,
  "shareActivityWithFriends": false,
  "allowFriendRequests": true,
  "hideSpoilersUntilWatched": true
}
```

Profile responses may include generated `friendCode` used for friend requests.

## Franchises and Smart Discovery

Curated franchise catalogs are public. Personal completion requires authentication.

```http
GET /franchises
GET /franchises/:slug
GET /me/franchises/:slug/progress?order=release|chronological
GET /discover/suggestions?mood={mood}&maxMinutes={minutes}&providers={ids}&region={cc}&language={lang}
```

`mood` supports `relaxing`, `mind-bending`, `emotional`, `epic`, and `quick-watch`. When signed in, suggestions may include unfinished franchise next titles and will use saved `preferredProviderIds` / `watchRegion` from settings when query params are omitted.

Settings also accept:

```json
{
  "preferredProviderIds": [8, 337],
  "watchRegion": "US"
}
```

## Profile History

History endpoints require authentication and return watched movie and episode events for the signed-in user, ordered by `watchedAt` descending.

```http
GET /me/history?page={page}&pageSize={pageSize}
```

Query parameters:

- `page` — optional positive integer, default `1`
- `pageSize` — optional positive integer, default `25`, maximum `100`

Response:

```json
{
  "items": [
    {
      "historyId": "tv_95396_s01e01",
      "tmdbId": 95396,
      "mediaType": "tv",
      "title": "Severance",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "episodeTitle": "Good News About Hell",
      "watchedAt": "2026-07-10T07:00:00.000Z",
      "updatedAt": "2026-07-10T07:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 25,
  "totalCount": 18,
  "hasMore": false
}
```

Movie history entries use `mediaType: "movie"` and return `null` for episode fields.

## Profile and User Settings

Profile endpoints require authentication and store personal profile fields under `users/{uid}`. `email` is derived from Firebase Auth on writes and should not be trusted from client request bodies.

```http
GET /me/profile
```

Response:

```json
{
  "profile": {
    "firstName": "Rich",
    "lastName": "Chang",
    "email": "rich@example.com",
    "displayName": "Rich Chang",
    "photoURL": null,
    "bio": null,
    "country": null,
    "timezone": "Asia/Taipei",
    "friendCode": "ABC123",
    "createdAt": "2026-07-11T07:00:00.000Z",
    "updatedAt": "2026-07-11T07:00:00.000Z"
  }
}
```

`profile` is `null` when a signed-in user has no profile document yet.

```http
PATCH /me/profile
```

Request:

```json
{
  "firstName": "Rich",
  "lastName": "Chang",
  "bio": "Optional short profile text.",
  "timezone": "Asia/Taipei"
}
```

Response: updated profile. `firstName` and `lastName` are required before a profile document can be created; optional fields are `displayName`, `photoURL`, `bio`, `country`, and `timezone`.

Settings endpoints require authentication and store user preferences under `users/{uid}/settings/profile`.

```http
GET /me/settings
```

Response:

```json
{
  "autoMarkPreviousEpisodesWatched": false,
  "language": "en-US",
  "preferredProviderIds": [8],
  "watchRegion": "US",
  "achievementsEnabled": true,
  "showAchievementsOnProfile": true,
  "shareActivityWithFriends": false,
  "allowFriendRequests": true,
  "hideSpoilersUntilWatched": true,
  "updatedAt": "2026-07-11T07:00:00.000Z"
}
```

```http
PATCH /me/settings
```

Request:

```json
{
  "autoMarkPreviousEpisodesWatched": true,
  "language": "zh-TW",
  "shareActivityWithFriends": true
}
```

Response: updated settings. Supported language values are `en-US` and `zh-TW`. The API stores `autoMarkPreviousEpisodesWatched`, but does not itself expand a single-episode progress request. The current web client implements the behavior by sending previous unwatched episodes through the batch endpoint.

```http
DELETE /me/account
```

Permanently deletes the signed-in user's Firestore data under `users/{uid}` (profile, watchlist, progress, history, settings, ratings, friends, imports) and removes the Firebase Authentication user. Returns `204 No Content` on success. This action is irreversible.

## TV Time import

Supports (1) browser-side TV Time GDPR ZIP parsing with server-side show resolution, or (2) CSVs from `tv_time_tool/generate_episodera_import.py`. All routes require a Firebase ID token. Staging chunks are limited to 200 rows; each `/run` processes up to 100 pending episodes plus pending watchlist merges.

```http
POST /me/imports/resolve-tv-time-shows
```

Resolve TV Time show titles to TMDb IDs after the client has parsed a GDPR ZIP locally. Chunks are limited to 25 shows. High-confidence matches (`confidence >= 0.82`, not `ambiguous`) are accepted; remakes/overrides known to the server are applied automatically.

```json
{ "shows": [{ "sourceShowId": "100", "title": "Silo" }] }
```

Response `200`:

```json
{
  "accepted": [
    {
      "sourceShowId": "100",
      "tmdbId": 125988,
      "title": "Silo",
      "poster": "https://image.tmdb.org/t/p/w500/…",
      "backdrop": null,
      "confidence": 1,
      "matchMethod": "exact"
    }
  ],
  "skipped": [
    {
      "sourceShowId": "200",
      "title": "Ambiguous Show",
      "reason": "ambiguous",
      "confidence": 0.88,
      "notes": "Close runner-up: …",
      "candidates": [
        {
          "tmdbId": 111,
          "title": "Ambiguous Show",
          "poster": null,
          "backdrop": null,
          "year": "2020"
        }
      ]
    }
  ]
}
```

Skipped rows include up to five TMDb `candidates` for the Settings mapping-review UI. Resolving also consults persisted `mediaMappings` (see below) before search.

```http
PUT /me/imports/media-mappings
```

Persist a provider → TMDb override for future resolves (and the current import after review). Body:

```json
{
  "provider": "tv_time",
  "mediaType": "tv",
  "externalId": "200",
  "tmdbId": 111,
  "title": "Ambiguous Show"
}
```

Response `200`: `{ "mapping": MediaMapping }` with `updatedBy` / `updatedAt`. Documents live at root `mediaMappings/{provider}_{mediaType}_{externalId}` (Cloud Functions only; client R/W denied).

```http
POST /me/imports
```

```json
{ "provider": "tv_time", "sourceHash": "optional-idempotency-key" }
```

Response `201`: `{ "import": ImportJobSummary }`.

```http
GET /me/imports/:importId
POST /me/imports/:importId/watchlist
POST /me/imports/:importId/episodes
POST /me/imports/:importId/commit
POST /me/imports/:importId/run
```

Watchlist staging body: `{ "items": [{ "tmdbId", "mediaType", "title", "status", "poster?", "backdrop?", "sourceShowId?" }] }`.  
Episode staging body: `{ "episodes": [{ "tmdbId", "seasonNumber", "episodeNumber", "watchedAt?", "sourceShowId?", "sourceEpisodeId?", "bulkType?" }] }`.

`/run` response:

```json
{
  "import": { "importId": "...", "status": "running", "episodesImported": 100 },
  "processedEpisodes": 100,
  "remainingEpisodes": 4500,
  "done": false
}
```

Import rules: historical `watchedAt` is preserved when provided; existing watched episodes keep the earliest timestamp; watchlist statuses never downgrade; clients loop `/run` until `done` is true. The Settings UI accepts a GDPR `.zip` (parsed in-browser), pauses for unmatched/ambiguous show review (saving picks via `media-mappings`), or the two prepared CSVs, then drives this loop.

## Errors

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "missing_query",
    "message": "Query parameter q is required."
  }
}
```

Defined error codes:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `missing_query` | `/search` was called without `q`. |
| `400` | `invalid_id` | A detail endpoint received a non-positive numeric ID. |
| `400` | `invalid_show_id` | A progress endpoint received a non-positive TV show ID. |
| `400` | `invalid_episode_key` | An episode progress key was not formatted like `s01e01`. |
| `400` | `invalid_progress_payload` | A progress request body failed validation. |
| `400` | `batch_too_large` | A batch progress request contained more than 100 input entries. |
| `400` | `invalid_media_type` | Progress was requested for media that is not a TV show. |
| `400` | `invalid_item_id` | A watchlist item ID was not formatted as `movie_550` or `tv_95396`. |
| `400` | `invalid_profile_payload` | A profile request body failed validation. |
| `400` | `invalid_firstName` / `invalid_lastName` | A supplied name was not a string. |
| `400` | `invalid_displayName` / `invalid_photoURL` / `invalid_bio` / `invalid_country` / `invalid_timezone` | A supplied optional profile field was neither a string nor `null`. |
| `400` | `missing_profile_fields` | A profile update contained no supported fields. |
| `400` | `invalid_status` | A watchlist status was not one of the allowed values. |
| `400` | `invalid_settings_payload` | A settings request body failed validation. |
| `400` | `invalid_auto_mark_previous_episodes_watched` | `autoMarkPreviousEpisodesWatched` was not a boolean. |
| `400` | `missing_settings` | A settings update contained no supported settings. |
| `400` | `missing_firstName` | A profile write did not include a required first name. |
| `400` | `missing_lastName` | A profile write did not include a required last name. |
| `400` | `invalid_watchlist_payload` | A watchlist request body failed validation. |
| `400` | `unsupported_language` | A settings update used a language other than `en-US` or `zh-TW`. |
| `401` | `unauthenticated` | A protected endpoint was called without a valid user. |
| `403` | `origin_not_allowed` | The browser request origin is not in `CORS_ORIGINS`. |
| `404` | `episode_not_found` | A requested season/episode does not exist in the canonical TMDb show metadata. |
| `404` | `watchlist_item_not_found` | A watchlist item was not found for the signed-in user. |
| `429` | `rate_limited` | The applicable per-instance request bucket was exhausted. |
| `500` | `progress_update_failed` | Progress could not be read immediately after a successful update transaction. |
| `500` | `profile_update_failed` | The updated profile could not be read back. |
| `500` | `internal` | An unhandled backend error occurred. |
| `502` | `tmdb_request_failed` | TMDb returned an unsuccessful response. |
