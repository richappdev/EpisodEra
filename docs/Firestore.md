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
  "firstName": "Rich",
  "lastName": "Chang",
  "email": "rich@example.com",
  "displayName": "Rich Chang",
  "photoURL": "https://example.com/avatar.png",
  "bio": "Optional short profile text.",
  "country": "TW",
  "timezone": "Asia/Taipei",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

`firstName`, `lastName`, and `email` are required for newly written profile documents. Optional personal fields may be omitted or stored as `null`.

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
  "nextEpisode": {
    "episodeKey": "s01e03",
    "seasonNumber": 1,
    "episodeNumber": 3,
    "episodeTitle": "In Perpetuity"
  },
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

Rules also validate expected document IDs, allowed field names, and basic field types for user-owned write paths. Cloud Functions remain responsible for canonical TMDb validation and cross-document consistency, because Admin SDK writes bypass security rules.

Rules tests live in `functions/src/firestoreRules.emulator.test.ts` and run with:

```bash
cd functions
npm run test:emulator
```

Account deletion uses the Admin SDK `recursiveDelete` operation on `users/{uid}` from `DELETE /me/account`. This removes the profile document and all owner-scoped subcollections (watchlist, progress, history, settings, ratings) before deleting the Firebase Authentication user.

Java is required by the Firebase Emulator Suite.

## Indexes

No composite indexes are required yet. Add indexes when screens need cross-field sorting or filtering such as:

- Watchlist by `status` and `updatedAt`.
- History by `watchedAt`.
- Ratings by `rating` and `updatedAt`.
- Public curated lists by `publishedAt` and `slug`.
