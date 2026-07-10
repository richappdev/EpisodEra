# API

The backend exposes a single Firebase HTTPS Function named `api`. In local emulators the base URL is:

```text
http://127.0.0.1:5001/<firebase-project-id>/us-central1/api
```

All responses are JSON. Read-only discovery endpoints can be called without authentication. Endpoints that later modify user state should require a Firebase ID token in the `Authorization` header:

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
| `401` | `unauthenticated` | A protected endpoint was called without a valid user. |
| `502` | `tmdb_request_failed` | TMDb returned an unsuccessful response. |
| `500` | `internal` | Unhandled backend error. |
