# Firestore

Firestore stores user-owned application state. TMDb remains the source of truth for media metadata, so documents should reference TMDb IDs and cache only the fields needed for display or offline convenience.

**Baseline:** tip `d72b191` (2026-07-20) + local P0 hardening (staging cleanup, App Check smoke probe, import smoke path, SHA-256 sourceHash, import resume). App Check **Phase 3 enforce** is live in production (`APP_CHECK_ENFORCE_AUTH_WRITES=true`); code default remains off until that env flag is set. TV Time import Phase 1 **code** includes A9 staging cleanup; Phase 1 **acceptance** remains **OPEN** — evidence ledger in [`docs/TvTimeImportPhase1Acceptance.md`](./TvTimeImportPhase1Acceptance.md) (A8 **PASS**; A4/A5/A9 **code landed**, tip-matched hosted smoke + soak still open). Franchise catalogs live in Firestore `franchises/{slug}` and are served only through Cloud Functions (`GET /franchises*`); bundled `functions/src/data/franchises.ts` is the seed source and read-failure fallback. Achievements, challenges, year recap, and discovery suggestions remain computed in Cloud Functions. Append-only `watchEvents` remains planned (Data Schema Phase 2); see Notion *TV Time Data Schema Analysis*.

## Collections

```text
users/{userId}
users/{userId}/watchlist/{mediaType_id}
users/{userId}/progress/{showId}
users/{userId}/progress/{showId}/episodes/{episodeKey}
users/{userId}/history/{historyId}
users/{userId}/settings/profile
users/{userId}/ratings/{mediaType_id}
users/{userId}/friends/{friendUserId}
users/{userId}/imports/{importId}
users/{userId}/imports/{importId}/stagedShows/{mediaType_tmdbId}
users/{userId}/imports/{importId}/stagedEpisodes/{tv_tmdbId_sNNeNN}
mediaMappings/{provider}_{mediaType}_{externalId}
franchises/{slug}
public/discussions/{movie|tv}_{tmdbId}/{commentId}
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
  "friendCode": "AB12CD",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

`firstName`, `lastName`, and `email` are required for newly written profile documents. Optional personal fields may be omitted or stored as `null`. `friendCode` is a server-managed 6-character uppercase code used for friend requests. Clients may read it on their own profile document but cannot create or update it through Firestore rules; Cloud Functions (Admin SDK) own writes.

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
  "poster": "https://image.tmdb.org/t/p/w500/example.jpg",
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

`progressPercent` is rounded to two decimal places by the backend. `poster` is optional; missing posters are backfilled from TMDb on `GET /progress` and persisted without changing `updatedAt`.

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
  "updatedAt": "<server timestamp>",
  "rewatchCount": 0,
  "genreNames": ["Drama", "Sci-Fi"],
  "runtimeMinutes": 57
}
```

For movie entries, `seasonNumber`, `episodeNumber`, and `episodeTitle` are `null`. `rewatchCount` is required for new writes (defaults to `0`). `genreNames` and `runtimeMinutes` are optional enrichment fields; older documents may omit them. History supports `PATCH` and `DELETE` via `/me/history/:historyId` (TV deletes also clear related progress).

## users/{userId}/settings/profile

Stores user preferences.

Shape:

```json
{
  "autoMarkPreviousEpisodesWatched": false,
  "language": "en-US",
  "preferredProviderIds": [8, 9],
  "watchRegion": "TW",
  "achievementsEnabled": true,
  "showAchievementsOnProfile": true,
  "shareActivityWithFriends": false,
  "allowFriendRequests": true,
  "hideSpoilersUntilWatched": true,
  "updatedAt": "<server timestamp>"
}
```

Allowed `language` values:

```text
en-US
zh-TW
```

`preferredProviderIds` is limited to 12 TMDb provider IDs. `watchRegion` is a 2-letter region code when present.

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

## users/{userId}/friends/{friendUserId}

Friendship edges. Document IDs are the other user's Firebase Auth UID. Cloud Functions (Admin SDK) create and update these documents; clients may only read or delete their own friend docs.

```json
{
  "status": "accepted",
  "friendCode": "AB12CD",
  "displayName": "Friend Name",
  "updatedAt": "<server timestamp>"
}
```

Allowed `status` values: `pending_outgoing`, `pending_incoming`, `accepted`.

## public/discussions/{movie|tv}_{tmdbId}/{commentId}

Spoiler-aware discussion comments. Written only by Cloud Functions; readable by clients under `public/**` rules. Spoiler hiding is derived from the viewer’s watch history and `hideSpoilersUntilWatched`.

## users/{userId}/imports/{importId}

TV Time (and future provider) import jobs. Written only by Cloud Functions; clients may read.

```json
{
  "provider": "tv_time",
  "status": "draft",
  "sourceHash": "optional-idempotency-key",
  "watchlistStaged": 0,
  "episodesStaged": 0,
  "watchlistImported": 0,
  "episodesImported": 0,
  "episodesSkipped": 0,
  "episodesFailed": 0,
  "errorMessage": null,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "completedAt": null,
  "stagingClearedAt": null,
  "stagingDocsDeleted": 0
}
```

`stagedShows` and `stagedEpisodes` hold pending rows before `/run`. After a successful import (`done: true`), Functions delete those subcollections and set `stagingClearedAt` / `stagingDocsDeleted` on the job document. Episode progress written by import may include `source` (`tv_time`) and `sourceImportId`, and preserve historical `watchedAt`.

## mediaMappings/{provider}_{mediaType}_{externalId}

Shared provider → TMDb ID overrides used by ZIP resolve (`PUT /me/imports/media-mappings`). Written only by Cloud Functions; client read/write denied.

```json
{
  "provider": "tv_time",
  "mediaType": "tv",
  "externalId": "200",
  "tmdbId": 111,
  "title": "Ambiguous Show",
  "updatedBy": "<uid>",
  "updatedAt": "<timestamp>"
}
```

Document ID format: `{provider}_{mediaType}_{externalId}` (e.g. `tv_time_tv_200`).

## franchises/{slug}

Curated franchise catalogs (editorial phases, title orders, TMDb ids). Written by Admin SDK / seed script; client read/write denied. Cloud Functions load published docs with an in-memory TTL cache and serve them via `GET /franchises` and `GET /franchises/:slug`.

```json
{
  "slug": "spider-man-holland",
  "name": "Spider-Man (Tom Holland)",
  "description": "Tom Holland's MCU Spider-Man trilogy in release and chronological order.",
  "published": true,
  "sortOrder": 3,
  "phases": [{"id": "trilogy", "name": "MCU Trilogy"}],
  "titles": [
    {
      "tmdbId": 315635,
      "mediaType": "movie",
      "title": "Spider-Man: Homecoming",
      "phaseId": "trilogy",
      "releaseOrder": 1,
      "chronologicalOrder": 1,
      "runtimeMinutes": 133,
      "providerIds": [337]
    }
  ],
  "updatedAt": "<timestamp>"
}
```

Document ID equals `slug`. Only `published: true` docs are listed. Seed from the bundled catalogs:

```bash
cd functions
npm run seed:franchises
```

**Read fallback (Functions):** live Firestore → stale in-memory cache → bundled `functions/src/data/franchises.ts`. A healthy empty published set returns an empty list (no silent bundled merge). Unknown slugs still return `404 franchise_not_found`.

## Not stored in Firestore

- Achievements, challenges, year recap, discovery suggestions: computed in Cloud Functions (franchise progress overlays use the remote/bundled catalogs above)
- Personal data export (`GET /me/export`): assembled on demand from history, progress, and watchlist — see [ExportFormat.md](./ExportFormat.md)
- Append-only `watchEvents`: planned (Data Schema Phase 2), not shipped

## Security Rules

The current `firestore.rules` policy is intentionally narrow:

- Users can create/read/update/delete only their own `users/{uid}` document (`friendCode` is Admin-write only).
- Users can read/write only their own `watchlist` and `ratings` subcollections.
- Users can read/write only their own `progress` documents and nested `episodes`.
- Users can read/write only their own `history` documents.
- Users can read/write only their own `settings` documents.
- Users can read/delete their own `friends` documents; client create/update is denied.
- Users can read their own `imports` tree; client writes are denied (Cloud Functions only).
- `mediaMappings/**` client read/write is denied (Cloud Functions only).
- `franchises/**` client read/write is denied (Cloud Functions only).
- `public/**` is read-only for all clients (includes discussions).
- Everything else is denied by default.

Rules also validate expected document IDs, allowed field names, and basic field types for user-owned write paths. Cloud Functions remain responsible for canonical TMDb validation and cross-document consistency, because Admin SDK writes bypass security rules.

Rules tests live in `functions/src/firestoreRules.emulator.test.ts` and run with:

```bash
cd functions
npm run test:emulator
```

Account deletion uses the Admin SDK `recursiveDelete` operation on `users/{uid}` from `DELETE /me/account`. This removes the profile document and all owner-scoped subcollections (watchlist, progress, history, settings, ratings, friends, imports) before deleting the Firebase Authentication user. Discussion comments under `public/discussions/**` are not part of the user tree and need a separate retention/moderation policy.
Java is required by the Firebase Emulator Suite.

## Indexes

No composite indexes are required yet. Add indexes when screens need cross-field sorting or filtering such as:

- Watchlist by `status` and `updatedAt`.
- History by `watchedAt`.
- Ratings by `rating` and `updatedAt`.
- Additional franchise filters beyond the current in-memory `published` + `sortOrder` sort (catalogs are small today).
