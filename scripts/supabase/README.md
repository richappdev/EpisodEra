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
# After db push (including upsert_identity_mapping RPC):
node scripts/supabase/backfill-profiles.mjs --dry-run --limit 5
node scripts/supabase/backfill-profiles.mjs
```

Do not commit database passwords or service-role keys. Linked credentials stay in `supabase/.temp/` (gitignored).
