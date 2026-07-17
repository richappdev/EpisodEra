# EpisodEra personal data export

EpisodEra exports use a **TMDb-centric JSON** format (not TV Time GDPR CSV). Schema version is `1`.

## Download

Signed-in users can download from **Settings → Export your data**. The API returns a single JSON document; the web app packages it as a ZIP:

```text
episodera-export-YYYY-MM-DD.zip
├── manifest.json
├── history.json
├── progress.json
└── watchlist.json
```

## API

```http
GET /me/export
Authorization: Bearer <firebase-id-token>
```

Response body matches the in-memory export object (same fields as the ZIP members, nested under `manifest`, `history`, `progress`, `watchlist`).

## `manifest.json`

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-07-17T12:00:00.000Z",
  "userId": "<firebase-uid>",
  "counts": {
    "history": 18,
    "progressShows": 3,
    "progressEpisodes": 42,
    "watchlist": 12
  }
}
```

## `history.json`

Array of history timeline entries (`HistoryEntry`): `historyId`, `tmdbId`, `mediaType`, `title`, season/episode fields, `watchedAt`, `updatedAt`, `rewatchCount`, optional `genreNames` / `runtimeMinutes`.

## `progress.json`

Array of show progress objects with nested `episodes` (full `ShowProgress` shape from the progress API).

## `watchlist.json`

Array of watchlist items (`WatchlistItem`).

## Notes

- IDs are TMDb, not TVDB.
- Re-import of this ZIP is not implemented yet; TV Time import remains a separate flow.
- Bump `schemaVersion` when the file shape changes incompatibly.
