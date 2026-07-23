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

Progress mutations use `mark_episodes_watched` RPC. Profiles/settings/derived write Supabase first.

**Status:** enable `SUPABASE_WRITE_PRIMARY` in prod when library reads look good; do **not** set `FIRESTORE_WRITES_DISABLED` until outbox stays clean for a soak window.

## Step C — stop Firestore persistence

Only after soak is green and outbox is drained:

```env
SUPABASE_WRITE_PRIMARY=true
FIRESTORE_WRITES_DISABLED=true
```

## Still on Firestore (not cut over yet)

Puzzles, discussions, franchises catalog, media mappings, import **staging** rows. Auth remains Firebase until Phase 9.

## Not automatic

This repo never deletes the Firebase project. Keep a Firestore export for the retention window.
