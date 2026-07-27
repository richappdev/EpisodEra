# Cutover — Supabase as database of record

## Already on (prod)

```env
SUPABASE_SHADOW_WRITES=true
SUPABASE_READ_PROFILES=true
SUPABASE_READ_SETTINGS=true
SUPABASE_READ_WATCHLIST=true
```

## Step A — finish library reads (safe)

```env
SUPABASE_READ_PROGRESS=true
SUPABASE_READ_HISTORY=true
SUPABASE_READ_FRIENDS=true
SUPABASE_READ_DERIVED=true
# or one switch for all library reads:
# SUPABASE_READ_PRIMARY=true
```

Redeploy Functions. Verify progress / history / friends / stats on the live site.

## Step B — write primary (still optional Firestore mirror)

```env
SUPABASE_WRITE_PRIMARY=true
# keep FIRESTORE_WRITES_DISABLED unset so Firestore still mirrors during soak
```

Progress mutations use `mark_episodes_watched` RPC. Profiles/settings/derived/watchlist/likes/history/friends/imports write Supabase first when this flag is on. Remaining domains (discussions, puzzles, franchises, media mappings, import staging) also honor write-primary via `writeSupabasePrimaryOrShadow`.

**Status:** enable `SUPABASE_WRITE_PRIMARY` in prod when library reads look good; do **not** set `FIRESTORE_WRITES_DISABLED` until outbox stays clean for a soak window.

## Step C — stop Firestore persistence

Only after soak is green and outbox is drained:

```env
SUPABASE_WRITE_PRIMARY=true
FIRESTORE_WRITES_DISABLED=true
```

**Status:** enable after write-primary soak. All product writers that honor `shouldPersistFirestore()` then persist to Supabase only.

To catch up Firestore after a period with mirror off:

```bash
node scripts/supabase/sync-supabase-to-firestore.mjs --dry-run
node scripts/supabase/sync-supabase-to-firestore.mjs
```

Then set `FIRESTORE_WRITES_DISABLED=false` (keep `SUPABASE_WRITE_PRIMARY=true`) and redeploy so new writes mirror again.

## Remaining-domain reads (after backfill)

```env
SUPABASE_READ_DISCUSSIONS=true
SUPABASE_READ_PUZZLES=true
SUPABASE_READ_FRANCHISES=true
SUPABASE_READ_MEDIA_MAPPINGS=true
SUPABASE_READ_IMPORT_STAGING=true
# or SUPABASE_READ_PRIMARY=true once library + remaining domains are soaked
```

Backfill first:

```bash
node scripts/supabase/backfill-remaining-domains.mjs --dry-run
node scripts/supabase/backfill-remaining-domains.mjs
```

Apply migration `20260727120001_remaining_domain_cutover.sql` (discussion columns + private-schema RPCs) before writers/backfill.

## Auth

Auth remains Firebase until Phase 9.

## Not automatic

This repo never deletes the Firebase project. Keep a Firestore export for the retention window.
