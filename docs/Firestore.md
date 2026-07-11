# Firestore

Firestore stores user-owned application state. TMDb remains the source of truth for media metadata, so documents should reference TMDb IDs and cache only the fields needed for display or offline convenience.

## Collections

```text
users/{userId}
users/{userId}/watchlist/{mediaType_id}
users/{userId}/progress/{showId}
users/{userId}/progress/{showId}/episodes/{episodeKey}
users/{userId}/history/{historyId}
users/{userId}/settings/profile
users/{userId}/ratings/{mediaType_id}
public/{document}
```

## users/{userId}

User profile document. The document ID must match the Firebase Auth UID.

```json
{
  "displayName": "Rich",
  "photoURL": "https://example.com/avatar.png",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

## users/{userId}/watchlist/{mediaType_id}

Tracks saved movies and TV shows.

Recommended document ID format:

```text
movie_550
tv_95396
```

Shape:

```json
{
  "tmdbId": 95396,
  "mediaType": "tv",
  "title": "Severance",
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w780/example.jpg",
  "status": "watching",
  "addedAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

Allowed TV `status` values are enforced by backend code:

```text
planned
watching
completed
dropped
```

Allowed movie `status` values are enforced by backend code:

```text
unwatched
watched
```

## users/{userId}/progress/{showId}

Tracks per-show episode progress. The document ID is the TMDb TV show ID as a string, such as `95396`.

Shape:

```json
{
  "tmdbId": 95396,
  "title": "Severance",
  "totalEpisodes": 19,
  "watchedEpisodeCount": 2,
  "progressPercent": 10.53,
  "currentSeason": 1,
  "currentEpisode": 2,
  "updatedAt": "<server timestamp>"
}
```

`progressPercent` is rounded to two decimal places by the backend.

## users/{userId}/progress/{showId}/episodes/{episodeKey}

Stores each watched episode for a show.

Recommended document ID format:

```text
s01e01
s02e10
```

Shape:

```json
{
  "seasonNumber": 1,
  "episodeNumber": 1,
  "episodeTitle": "Good News About Hell",
  "watched": true,
  "watchedAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

## users/{userId}/history/{historyId}

Stores watched movie and watched episode events for the user's recent history timeline.

Recommended document ID formats:

```text
movie_550
tv_95396_s01e01
```

Shape:

```json
{
  "tmdbId": 95396,
  "mediaType": "tv",
  "title": "Severance",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "episodeTitle": "Good News About Hell",
  "watchedAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

For movie entries, `seasonNumber`, `episodeNumber`, and `episodeTitle` are `null`.

## users/{userId}/settings/profile

Stores user preferences.

Shape:

```json
{
  "autoMarkPreviousEpisodesWatched": false,
  "language": "en-US",
  "updatedAt": "<server timestamp>"
}
```

Allowed `language` values:

```text
en-US
zh-TW
```

## users/{userId}/ratings/{mediaType_id}

Stores private user ratings.

```json
{
  "tmdbId": 550,
  "mediaType": "movie",
  "rating": 4.5,
  "review": "Optional notes",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

## Security Rules

The current `firestore.rules` policy is intentionally narrow:

- Users can create/read/update/delete only their own `users/{uid}` document.
- Users can read/write only their own `watchlist` and `ratings` subcollections.
- Users can read/write only their own `progress` documents and nested `episodes`.
- Users can read/write only their own `history` documents.
- Users can read/write only their own `settings` documents.
- `public/**` is read-only for all clients.
- Everything else is denied by default.

When backend write endpoints are introduced, prefer validating document shape in Cloud Functions and keeping direct client writes limited to simple user-owned data.

## Indexes

No composite indexes are required yet. Add indexes when screens need cross-field sorting or filtering such as:

- Watchlist by `status` and `updatedAt`.
- History by `watchedAt`.
- Ratings by `rating` and `updatedAt`.
- Public curated lists by `publishedAt` and `slug`.
