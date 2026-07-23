# Schema inventory (Firestore → Postgres)

Source of truth for DDL: `supabase/migrations/*.sql`.

| Firestore | PostgreSQL | Notes |
| --- | --- | --- |
| `users/{uid}` | `public.profiles` | PK `firebase_uid` |
| `users/{uid}/settings/profile` | `public.user_settings` | |
| `users/{uid}/watchlist/*` | `public.watchlist_items` | unique (uid, media_type, tmdb_id) |
| `users/{uid}/likes/*` | `public.likes` | shipped product |
| `users/{uid}/ratings/*` | `public.ratings` | reserved; not dual-written yet |
| `users/{uid}/progress/{showId}` | `public.show_progress` | includes `watched_episode_keys` |
| `…/progress/…/episodes/*` | `public.watched_episodes` | + import provenance columns |
| `users/{uid}/history/*` | `public.watch_history` | `history_key` deterministic |
| `users/{uid}/derived/*` | `private.derived_cache` | TTL envelope, not live views day one |
| `users/{uid}/friends/*` | `public.friendships` | mirrored edges |
| `users/{uid}/imports/*` | `public.imports` | |
| `…/stagedShows`, `stagedEpisodes` | `private.import_staged_*` | |
| `mediaMappings/*` | `public.media_mappings` | |
| `franchises/*` | `public.franchises` | jsonb phases/titles |
| `public/discussions/...` | `public.discussion_comments` | flat table |
| `puzzlePublic/*` | `public.puzzles_public` | |
| `puzzlePrivate/*` | `private.puzzles_private` | |
| `puzzleAttempts/*` | `public.puzzle_attempts` | `player_id` text |
| `userGameStats/*` | `public.user_game_stats` | |
| `gameConfig/dailyPuzzle` | `private.game_config` | |
| (migration) | `private.identity_mappings` | |
| (migration) | `private.migration_sync_failures` | delta-sync outbox |

## Deletion cascades

Account deletion must explicitly decide orphans that Firestore `recursiveDelete(users/{uid})` does **not** clear today:

- `discussion_comments` by author
- `puzzle_attempts` by player
- `user_game_stats`

Postgres FKs cascade profile-owned rows; global discussion/puzzle rows need an explicit deletion service update before Auth cutover.
