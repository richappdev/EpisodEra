# Firestore

Firestore stores user-owned application state. TMDb remains the source of truth for media metadata, so documents should reference TMDb IDs and cache only the fields needed for display or offline convenience.

## Collections

```text
users/{userId}
users/{userId}/watchlist/{mediaType_id}
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
  "status": "watching",
  "addedAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

Allowed `status` values should be enforced by backend code when write endpoints are added:

```text
planned
watching
completed
dropped
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
- `public/**` is read-only for all clients.
- Everything else is denied by default.

When backend write endpoints are introduced, prefer validating document shape in Cloud Functions and keeping direct client writes limited to simple user-owned data.

## Indexes

No composite indexes are required yet. Add indexes when screens need cross-field sorting or filtering such as:

- Watchlist by `status` and `updatedAt`.
- Ratings by `rating` and `updatedAt`.
- Public curated lists by `publishedAt` and `slug`.
