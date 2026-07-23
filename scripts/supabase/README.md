# CLI link instructions

Cloud project: `xyhhnoxvydshqpypwccr`  
URL: https://xyhhnoxvydshqpypwccr.supabase.co

```bash
npx supabase login
npx supabase link --project-ref xyhhnoxvydshqpypwccr
npx supabase db push   # after reviewing migrations — manual approval for prod
```

`supabase init` is already done in this repo. `[auth.third_party.firebase]` is enabled for project id `episodera`.

Do not commit database passwords or service-role keys. Linked credentials stay in `supabase/.temp/` (gitignored).
