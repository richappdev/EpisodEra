# API

The backend exposes a single Firebase HTTPS Function named `api`. In local emulators the base URL is:

```text
http://127.0.0.1:5001/<firebase-project-id>/us-central1/api
```

All responses are JSON. Read-only discovery endpoints can be called without authentication. User-owned endpoints require a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

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
GET /search?q=severance&page=1
```

Parameters:

| Name | Required | Description |
| --- | --- | --- |
| `q` | Yes | Search query text. |
| `page` | No | Positive integer page number. Defaults to `1`. |

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
GET /trending?page=1
```

Returns weekly trending movies and TV shows using the same paged shape as `/search`.

For a single media type, use:

```http
GET /trending/movie?page=1
GET /trending/tv?page=1
GET /trending/shows?page=1
```

`/trending/tv` and `/trending/shows` both return weekly trending TV shows from TMDb's `/trending/tv/week` endpoint.

## Movie Detail

```http
GET /movie/:id
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
GET /tv/:id
```

Uses the same response shape as movie detail. `runtimeMinutes` is derived from the first TMDb `episode_run_time` value when available.

## TV Season Detail

```http
GET /tv/:id/season/:seasonNumber
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

Allowed `status` values:

```text
planned
watching
completed
dropped
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

`status`, `poster`, and `backdrop` are optional. `status` defaults to `planned`.

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
| `400` | `invalid_item_id` | A watchlist item ID was not formatted as `movie_550` or `tv_95396`. |
| `400` | `invalid_status` | A watchlist status was not one of the allowed values. |
| `400` | `invalid_watchlist_payload` | A watchlist request body failed validation. |
| `401` | `unauthenticated` | A protected endpoint was called without a valid user. |
| `404` | `watchlist_item_not_found` | A watchlist item was not found for the signed-in user. |
| `502` | `tmdb_request_failed` | TMDb returned an unsuccessful response. |
| `500` | `internal` | Unhandled backend error. |
