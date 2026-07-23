# CLI link instructions

Cloud project: `xyhhnoxvydshqpypwccr`  
URL: https://xyhhnoxvydshqpypwccr.supabase.co

```bash
npx supabase login
npx supabase link --project-ref xyhhnoxvydshqpypwccr
npx supabase db push   # after reviewing migrations — manual approval for prod
```

`supabase init` is already done in this repo. `[auth.third_party.firebase]` is enabled for project id `episodera`.

## Data backfill

```bash
# After db push (including upsert_identity_mapping + firebase_uid_probe RPCs):
node scripts/supabase/backfill-firebase-role-claim.mjs --dry-run
node scripts/supabase/prove-firebase-jwt.mjs --token "<FIREBASE_ID_TOKEN>"

node scripts/supabase/backfill-profiles.mjs --dry-run --limit 5
node scripts/supabase/backfill-profiles.mjs

node scripts/supabase/backfill-watchlist-likes.mjs --dry-run --limit 5
node scripts/supabase/backfill-watchlist-likes.mjs
```

## Full site export / restore

```bash
node scripts/supabase/export-firebase-site.mjs
node scripts/supabase/import-supabase-site.mjs --from docs/supabase/evidence/site-export-... --dry-run
node scripts/supabase/import-supabase-site.mjs --from docs/supabase/evidence/site-export-...
```

See [SiteExportImport.md](../docs/supabase/SiteExportImport.md).

## Reverse sync (Supabase → Firestore catch-up)

When Firestore mirror was off (`FIRESTORE_WRITES_DISABLED=true`), catch up library docs:

```bash
node scripts/supabase/sync-supabase-to-firestore.mjs --dry-run --limit 5
node scripts/supabase/sync-supabase-to-firestore.mjs --uid <FIREBASE_UID>
node scripts/supabase/sync-supabase-to-firestore.mjs
```

Requires Firebase Admin credentials + `functions/.env.supabase`. Covers profiles, settings, watchlist, likes, progress/episodes, history, friendships, and common derived cache keys. Does not sync puzzles/discussions/franchises/import staging.

## Phase 9 Auth cutover prep (do not flip production Auth)

```bash
node scripts/supabase/prepare-auth-cutover.mjs --from docs/supabase/evidence/site-export-...
```

See [AuthMigration.md](../docs/supabase/AuthMigration.md).

Do not commit database passwords or service-role keys. Linked credentials stay in `supabase/.temp/` (gitignored).
