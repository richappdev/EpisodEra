# API

The backend exposes a single Firebase HTTPS Function named `api`. In local emulators the base URL is:

```text
http://127.0.0.1:5001/<firebase-project-id>/us-central1/api
```

All responses are JSON. Read-only discovery endpoints can be called without authentication. User-owned endpoints require a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

Set `CORS_ORIGINS` to a comma-separated allowlist for deployed environments. When omitted, the API allows all origins for local development.

TMDb detail, TV season, and trending reads use a per-Functions-instance in-memory TTL cache. Stable detail and season metadata are cached longer than trending responses. Search requests are not cached.

## Rate limiting

The API applies per-Functions-instance rate limits before route handlers run:

| Bucket | Scope | Default |
| --- | --- | --- |
| Public reads | Client IP for `GET /search`, `GET /trending*`, `GET /movie/:id`, `GET /tv/:id`, and `GET /tv/:id/season/:seasonNumber` | 120 requests per 60 seconds |
| Authenticated writes | Firebase UID for `POST`, `PATCH`, and `DELETE` requests under `/watchlist`, `/progress`, and `/me/settings` | 60 requests per 60 seconds |

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

Responses include `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset` headers when a route is covered by a bucket.

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
| `page` | No | Positive integer page number. Defaults to `1`. |
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
  "homepage": "https://www.example.com"
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
GET /watchlist
```

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
  ]
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

Response: `201 Created` with the saved watchlist item.

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

Response: `204 No Content`.

## Episode Progress

Progress endpoints require authentication and read/write only the signed-in user's Firestore path:

```text
users/{uid}/progress/{showId}
users/{uid}/progress/{showId}/episodes/{episodeKey}
```

`showId` is the positive TMDb TV show ID. `episodeKey` is generated from season and episode numbers, such as `s01e01`.

### List Show Progress

```http
GET /progress
```

Lists summary-only show progress documents for the signed-in user, sorted by most recently updated. This endpoint does not read each show's `episodes` subcollection.

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
  ]
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

The backend validates the show, season, and episode against TMDb and resolves the canonical show title, episode title, and total episode count. Response: `201 Created` with the updated show progress. Re-marking the same episode is idempotent for counts.

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

`episodes` is deduplicated by season/episode and limited to 100 entries. The backend validates all requested episodes before writing, then updates episode rows, history entries, and the aggregate progress summary in one Firestore transaction.

Response: updated show progress.

### Mark Episode Unwatched

```http
DELETE /progress/:showId/episode/:episodeKey
```

Response: updated show progress.

## Profile Stats

Stats endpoints require authentication and derive counts from the signed-in user's watchlist and progress documents.

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
  "progressShowCount": 5
}
```

## Profile History

History endpoints require authentication and return watched movie and episode events for the signed-in user.

```http
GET /me/history
```

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
  ]
}
```

Movie history entries use `mediaType: "movie"` and return `null` for episode fields.

## User Settings

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
  "language": "zh-TW"
}
```

Response: updated settings. Supported language values are `en-US` and `zh-TW`. `autoMarkPreviousEpisodesWatched` controls whether marking a later episode watched also marks earlier unwatched episodes in that season.

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

Common status codes:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `missing_query` | `/search` was called without `q`. |
| `400` | `invalid_id` | A detail endpoint received a non-positive numeric ID. |
| `400` | `invalid_show_id` | A progress endpoint received a non-positive TV show ID. |
| `400` | `invalid_episode_key` | An episode progress key was not formatted like `s01e01`. |
| `400` | `invalid_progress_payload` | A progress request body failed validation. |
| `400` | `invalid_item_id` | A watchlist item ID was not formatted as `movie_550` or `tv_95396`. |
| `400` | `invalid_profile_payload` | A profile request body failed validation. |
| `400` | `invalid_status` | A watchlist status was not one of the allowed values. |
| `400` | `invalid_settings_payload` | A settings request body failed validation. |
| `400` | `missing_firstName` | A profile write did not include a required first name. |
| `400` | `missing_lastName` | A profile write did not include a required last name. |
| `400` | `invalid_watchlist_payload` | A watchlist request body failed validation. |
| `400` | `unsupported_language` | A settings update used a language other than `en-US` or `zh-TW`. |
| `401` | `unauthenticated` | A protected endpoint was called without a valid user. |
| `404` | `watchlist_item_not_found` | A watchlist item was not found for the signed-in user. |
| `502` | `tmdb_request_failed` | TMDb returned an unsuccessful response. |
| `500` | `internal` | Unhandled backend error. |
