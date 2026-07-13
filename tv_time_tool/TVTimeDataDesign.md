# TV Time Data Usage and Database Design Draft

Status: proposed  
Date: 2026-07-13

## Purpose

This document proposes how EpisodEra can use a user's TV Time GDPR export without copying TV Time's internal database or importing sensitive operational data. It is based on the combined export currently stored under `tv_time/combined` and the existing Firestore model in `docs/Firestore.md`.

The recommended product use is a one-time, user-initiated migration of followed shows and watched-episode progress. The export must not be treated as a live synchronization API.

## Observed Dataset

The combined export contains two source accounts and 43 raw CSV tables. The normalized viewing data contains:

| Measure | Observed value |
| --- | ---: |
| Unique shows | 153 |
| Followed shows | 152 |
| Shows with watched episodes | 132 |
| Unique watched episodes | 4,744 |
| Raw episode rows | 4,867 |
| Duplicate rows across source accounts | 123 |
| Recorded viewing span | 2017-11-30 to 2026-07-08 |
| Estimated episode runtime | 2,445 h 49 m |
| Season-zero episodes | 11 |
| Episode-zero records | 1 |
| Episodes with missing/zero runtime | 73 |
| Reported rewatches | 0 |

The 123 cross-account duplicates have already been collapsed in `normalized/episodes.csv`. The `source_accounts` field uses semicolon-separated values; analysis code should not test for commas.

Some TV Time totals disagree slightly with normalized rows (for example, the primary tracking summary reports 4,745 episodes). Derived EpisodEra statistics should therefore be calculated from successfully mapped, imported episode records rather than copied from TV Time's cached counters.

## Data Usage Decision

### Import

| Source data | EpisodEra use | Destination |
| --- | --- | --- |
| Followed show and archive state | Seed or merge the user's TV watchlist | `users/{uid}/watchlist/{itemId}` |
| Watched episode coordinates | Seed per-show progress | `users/{uid}/progress/{tmdbId}/episodes/{episodeKey}` |
| Earliest recorded timestamp | Preserve approximate historical order | episode progress and watch event |
| Source account and TV Time IDs | Deduplication, audit, and retry safety | import staging/provenance only |
| TV Time show title | Candidate lookup input and manual-review label | import staging only |
| Rating or emotion vote | Optional future import after value mapping is defined | user-owned rating/reaction collection |
| User-created lists | Optional future watchlist/list import | user-owned lists |

### Derive After Import

- Watched-episode count, progress percentage, current episode, and next episode.
- Completed/watching status using current TMDb episode metadata.
- Profile statistics and yearly/monthly viewing summaries.
- Runtime totals using current TMDb runtimes, with imported runtime used only as fallback.

### Do Not Import

The following raw export categories are unnecessary for product migration and create disproportionate privacy or security risk:

- Access tokens, refresh tokens, login records, and mail-validation tokens.
- IP addresses, device identifiers, AppsFlyer identifiers, install tracking, and webhook data.
- Email address, social identifiers, connections/friends, notification history, and internal badges.
- TV Time recommendation scores, addiction scores, cached statistics, and deployment telemetry.
- Raw comments or likes unless the product later offers a separately consented social-content migration.

Raw ZIP files and `raw-merged` CSV files must never be uploaded to Firestore, committed to source control, included in logs, or used as analytics payloads.

## Recommended Firestore Model

The existing `watchlist`, `progress`, and `history` collections remain the user-facing read model. Add import records and append-only watch events so migration is auditable and future rewatches are representable.

```text
users/{uid}
  watchlist/{mediaType_tmdbId}
  progress/{tmdbId}
    episodes/{episodeKey}
  watchEvents/{eventId}
  history/{historyId}                  # optional latest-event projection
  imports/{importId}
    stagedShows/{tvTimeShowId}
    stagedEpisodes/{tvTimeEpisodeId}

mediaMappings/{provider_media_externalId}
```

All `users/{uid}/**` data is private to that user. `mediaMappings` contains no user identifier and is writable only by trusted backend code.

### `users/{uid}/imports/{importId}`

One document per upload/import attempt.

```json
{
  "provider": "tv_time",
  "formatVersion": 1,
  "status": "needs_review",
  "sourceFileSha256": "<sha256>",
  "sourceAccountCount": 2,
  "counts": {
    "showsRead": 153,
    "episodesRead": 4744,
    "showsMapped": 0,
    "episodesImported": 0,
    "recordsSkipped": 0
  },
  "createdAt": "<server timestamp>",
  "startedAt": "<server timestamp>",
  "completedAt": null,
  "errorCode": null
}
```

Use the file hash as an idempotency key. A repeated upload can resume or return the prior result instead of duplicating progress.

Recommended states are `uploaded`, `normalizing`, `mapping`, `needs_review`, `importing`, `completed`, `partially_completed`, and `failed`.

### `users/{uid}/imports/{importId}/stagedShows/{tvTimeShowId}`

```json
{
  "provider": "tv_time",
  "externalShowId": "12345",
  "sourceTitle": "Example Show",
  "followed": true,
  "favorited": false,
  "sourceAccounts": ["primary", "legacy-1"],
  "mappedTmdbId": 95396,
  "mappingStatus": "matched",
  "mappingMethod": "external_id",
  "mappingConfidence": 1,
  "reviewedAt": null
}
```

Allowed mapping states should include `unmatched`, `candidate`, `matched`, `manual`, `ambiguous`, and `rejected`. Never silently accept a title-only match when multiple TMDb candidates exist.

### `users/{uid}/imports/{importId}/stagedEpisodes/{tvTimeEpisodeId}`

```json
{
  "externalShowId": "12345",
  "externalEpisodeId": "67890",
  "seasonNumber": 1,
  "episodeNumber": 2,
  "sourceRecordedAt": "2024-05-12T03:14:15Z",
  "sourceUpdatedAt": "2024-05-12T03:14:15Z",
  "sourceRuntimeSeconds": 2700,
  "sourceAccounts": ["primary"],
  "sourceRecordCount": 1,
  "bulkType": "fill-previous",
  "mappingStatus": "matched",
  "mappedTmdbId": 95396,
  "mappedEpisodeKey": "s01e02",
  "skipReason": null
}
```

Staging preserves evidence for review without contaminating canonical progress. It can be deleted after a short retention window once the import succeeds.

### `mediaMappings/{provider_media_externalId}`

Example document ID: `tv_time_tv_12345`.

```json
{
  "provider": "tv_time",
  "mediaType": "tv",
  "externalId": "12345",
  "tmdbId": 95396,
  "matchMethod": "external_id",
  "confidence": 1,
  "sourceTitle": "Example Show",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

This mapping is reusable across users. It must contain only media identity data, never a UID, source account, file hash, or viewing activity.

### Canonical Episode Progress

Extend the existing episode document with provenance fields written by the backend:

```json
{
  "seasonNumber": 1,
  "episodeNumber": 2,
  "episodeTitle": "Example Episode",
  "watched": true,
  "watchedAt": "<timestamp>",
  "watchedAtPrecision": "recorded",
  "source": "tv_time_import",
  "sourceImportId": "<importId>",
  "sourceExternalEpisodeId": "67890",
  "createdAt": "<server timestamp>",
  "updatedAt": "<server timestamp>"
}
```

TV Time's `created_at` is evidence of when the record was created, not necessarily the moment the episode was watched. `watchedAtPrecision: recorded` makes that limitation explicit. New activity created inside EpisodEra can use `watchedAtPrecision: exact`.

### `users/{uid}/watchEvents/{eventId}`

Use an auto-generated ID or a deterministic import ID such as a hash of provider, import, external episode ID, and source timestamp.

```json
{
  "mediaType": "tv",
  "tmdbId": 95396,
  "episodeKey": "s01e02",
  "seasonNumber": 1,
  "episodeNumber": 2,
  "watchedAt": "<timestamp>",
  "watchedAtPrecision": "recorded",
  "source": "tv_time_import",
  "sourceImportId": "<importId>",
  "sourceExternalId": "67890",
  "createdAt": "<server timestamp>"
}
```

The current `history/{historyId}` document ID is deterministic per movie or episode, so another watch overwrites the prior event. `watchEvents` should be the source of truth for timelines and rewatches. `history` may remain as a latest-watch projection for backward compatibility.

## Identity and Merge Rules

1. Resolve TV Time show ID to TMDb TV ID using a trusted external-ID mapping when available.
2. Otherwise search by title and supporting metadata, but require manual review for ambiguous results.
3. Resolve an episode using `(tmdbId, seasonNumber, episodeNumber)` against canonical TMDb season data.
4. Deduplicate source rows first by TV Time episode ID, then validate the episode coordinate.
5. Merge watched state with logical OR: an existing watched episode remains watched.
6. Preserve the earliest credible `watchedAt`; never replace it with import execution time.
7. Do not downgrade or remove existing user watchlist state during an import.
8. Recompute show summaries from canonical episode documents after each import batch.

Show titles are unsuitable as primary keys because names, localization, punctuation, and remakes can differ. TV Time IDs are suitable only inside provenance and mapping records; EpisodEra canonical records must continue to use TMDb IDs.

## Special and Invalid Episode Policy

The export has 11 season-zero episodes. TMDb uses season zero for specials, while the current service filters out all seasons below 1 and Firestore rules require a positive season number. Choose one explicit policy before import:

- Recommended: support specials by allowing `seasonNumber >= 0`, retaining keys such as `s00e01`, and including season zero in canonical lookup when requested.
- Alternative: preserve specials in staging with `skipReason: unsupported_special` and exclude them from progress totals.

The one episode-zero record should remain staged and be rejected or manually mapped. Do not weaken the canonical episode-number rule below `episodeNumber >= 1` without confirming a real TMDb episode.

Missing runtime does not block an import. Runtime is display/analytics metadata, not part of episode identity.

## Import Flow

```text
User uploads ZIP
  -> backend validates type, size, and expected CSV headers
  -> stream parse and normalize into user-owned staging documents
  -> discard tokens, IP/device data, and other excluded tables
  -> resolve reusable TV Time-to-TMDb show mappings
  -> present ambiguous/unmatched shows for review
  -> import canonical watchlist, episode progress, and watch events in batches
  -> recompute progress summaries
  -> mark import completed and schedule staging deletion
```

Run the import only in trusted backend code. Do not allow a client to write mapping, provenance, or arbitrary historical timestamps directly.

Firestore batches should stay comfortably below the 500-operation limit (for example, 200 episodes per batch) because each episode can require an episode document, event document, and summary work. A resumable cursor on the import document prevents a partial failure from restarting all 4,744 episodes.

## Queries and Indexes

Expected queries:

| Query | Index |
| --- | --- |
| User watch timeline | `watchEvents: watchedAt DESC` |
| Watch events for one show | `watchEvents: tmdbId ASC, watchedAt DESC` |
| Imports by recency | `imports: createdAt DESC` |
| Imports by status | `imports: status ASC, createdAt DESC` |
| Global mapping lookup by provider/external ID | Prefer deterministic document ID; no composite index |

Progress and watchlist indexes remain as described in `docs/Firestore.md`.

## Security, Consent, and Retention

- Require an explicit import confirmation that names the imported categories: followed shows, watched episodes, and timestamps.
- Treat the ZIP, raw CSV, timestamps, viewing activity, file hash, and import logs as private user data.
- Encrypt temporary object storage and use a short automatic deletion policy, preferably 24 hours or less.
- Delete staging documents after successful import and review, for example after 7 days. Keep only a minimal import receipt and aggregate counts.
- Redact filenames, email addresses, external user IDs, titles, tokens, IP addresses, and row payloads from application logs.
- Do not use imported viewing history for advertising, model training, public profiles, or cross-user recommendations without separate, specific consent.
- Include imports, staging, mappings tied to the user, and watch events in account export/deletion behavior. Global media mappings may remain because they contain no user data.
- Security rules should keep import data owner-readable but backend-write-only. Global mappings should be backend-write-only and may be client-readable only if there is a product need.

## Required Changes to the Current Application

1. Add `imports`, nested staging collections, and `watchEvents` to the backend model and account-deletion tests.
2. Add backend-only Firestore rules for import writes and extend rule tests.
3. Decide and implement season-zero support before promoting specials.
4. Add provenance fields to canonical episode validation, or keep provenance in a separate backend-only collection.
5. Make watch events append-only and use deterministic import event IDs for idempotency.
6. Add a mapping/review service from TV Time show IDs to TMDb IDs.
7. Recompute statistics from imported canonical documents rather than TV Time summary counters.
8. Correct the analyzer's cross-account check to recognize the semicolon delimiter.

## Minimum Viable Scope

For the first release, import only followed shows and watched episodes. Skip ratings, emotions, comments, lists, social data, and all device/auth data. Support review of unmatched shows, preserve import timestamps as approximate, and report exactly how many shows and episodes were imported, skipped, or require attention.
