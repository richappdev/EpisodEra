# Phases 7–10

## Phase 7 — Progress + history (shadow)

When `SUPABASE_SHADOW_WRITES=true`:

- `progressService.updateEpisodes` / `importWatchedEpisodes` → upsert `show_progress`, replace `watched_episodes`, sync TV `watch_history`
- `historyService` movie/episode record/update/delete → `watch_history`

Reads remain Firestore. Failures → migration outbox.

## Phase 8 — Social + derived cache (shadow)

- Friend request / accept / remove → `friendships`
- Derived stats/yearRecap/achievements set + invalidate → `private.derived_cache` via RPCs
- Import **job metadata** (create / stage / commit / run) → `public.imports` summary JSON

Staging rows (`stagedShows` / `stagedEpisodes`) stay in Firestore. Episode/watchlist merge reuses Phase 6–7 shadow writers after `importService.run`.

## Phase 9 — Native Supabase Auth (tooling only)

Do **not** flip production Auth until data soak is green.

```bash
node scripts/supabase/prepare-auth-cutover.mjs --from <site-export-dir>
node scripts/supabase/prepare-auth-cutover.mjs --from <dir> --apply-mappings
```

Then follow official Supabase Firebase Auth hash import + [AuthMigration.md](./AuthMigration.md).

## Phase 10 — Retirement (flags + checklist)

Prep flags (default off):

```env
# FIRESTORE_WRITES_DISABLED=true
# SUPABASE_READ_PRIMARY=true
```

Retirement order:

1. Shadow writes stable; outbox drained  
2. Historical import parity OK  
3. Switch reads domain-by-domain (`SUPABASE_READ_PROFILES`, later `SUPABASE_READ_PRIMARY`)  
4. Phase 9 Auth cutover + soak  
5. `FIRESTORE_WRITES_DISABLED` + Firebase read-only retention  
6. Remove Functions Firestore dependency / retire Auth after window  
7. Hosting/Analytics can lag  

This repo does **not** auto-delete Firebase projects.
