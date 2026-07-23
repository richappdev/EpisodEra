# Schema pipeline vs data pipeline

## Schema pipeline (version-controlled)

```text
supabase/migrations/*.sql
  → supabase db reset (local)
  → supabase/tests/*.sql
  → advisors (security / performance)
  → reviewed db push to xyhhnoxvydshqpypwccr
```

Rules:

- No bulk historical inserts in schema migrations
- MCP must not become an undocumented DDL channel
- Generated types (when enabled) commit alongside migrations

## Data pipeline (idempotent ETL)

```text
Firestore export
  → transform (scripts/supabase/)
  → validate
  → staging import
  → parity report → private.migration_parity_reports
  → production backfill
  → delta sync (dual-write + outbox)
```

Scripts:

| Script | Purpose |
| --- | --- |
| `export-firebase-auth.mjs` | Auth user export aid |
| `export-firestore-sample.mjs` | Representative docs for parity fixtures |
| `backfill-firebase-role-claim.mjs` | `role: authenticated` for Supabase bridge |
| `prove-firebase-jwt.mjs` | Auth bridge JWT proof against `firebase_uid_probe` |
| `backfill-profiles.mjs` | Firestore profiles + settings → Postgres |
| `backfill-watchlist-likes.mjs` | Firestore watchlist + likes → Postgres |

## Profiles + settings backfill

```bash
# Preview mapping (no Supabase writes)
node scripts/supabase/backfill-profiles.mjs --dry-run --limit 5

# One user
node scripts/supabase/backfill-profiles.mjs --uid <FIREBASE_UID>

# Full backfill (idempotent upserts)
node scripts/supabase/backfill-profiles.mjs
```

Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (see `functions/.env.supabase.example`), Firebase Admin credentials, and migration `20260723130001_upsert_identity_mapping_rpc.sql` applied (`npx supabase db push`).

## Watchlist + likes backfill

Run **after** profiles exist:

```bash
node scripts/supabase/backfill-watchlist-likes.mjs --dry-run --limit 5
node scripts/supabase/backfill-watchlist-likes.mjs --uid <FIREBASE_UID>
node scripts/supabase/backfill-watchlist-likes.mjs
# optional: create stub profiles when missing
node scripts/supabase/backfill-watchlist-likes.mjs --ensure-profile
```

## Auth bridge proof

```bash
node scripts/supabase/backfill-firebase-role-claim.mjs
node scripts/supabase/prove-firebase-jwt.mjs --token "<FIREBASE_ID_TOKEN>"
```

Raw dumps belong under `docs/supabase/evidence/` (gitignored).
