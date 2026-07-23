# Access boundary — Model A (API-first)

**Decision:** During migration, the browser does **not** write to Postgres via the Supabase Data API.

```text
Browser
  │ Firebase ID token (+ App Check while on Firebase)
  ▼
Express API (Cloud Functions → later Cloud Run)
  │ verifyIdToken / rate limit / TMDb / business rules
  ▼
Postgres (Supabase) via SUPABASE_SERVICE_ROLE_KEY
  ├── RLS enabled (defense in depth)
  └── private schema for identity, outbox, import staging, puzzle answers
```

## Allowed browser → Supabase (Model B — deferred)

Only after Model A is stable:

- Own profile read
- Public puzzle read
- Public franchise read
- Realtime discussion subscriptions
- Avatar storage with locked policies

## Table exposure checklist

For every table:

1. Is the schema exposed in `supabase/config.toml` `[api].schemas`?
2. Do `anon` / `authenticated` have table privileges? (Model A: **no** for mutable tables)
3. Is RLS enabled?
4. Are policies complete for future JWT tests?
5. Should the table live in `private`?

| Schema | Contents |
| --- | --- |
| `public` | profiles, settings, watchlist, likes, progress, history, friendships, imports metadata, puzzle public, game stats |
| `private` | identity_mappings, derived_cache, import staging, puzzle private, game_config, migration outbox |

## Secrets

- `SUPABASE_URL` — server only
- `SUPABASE_SERVICE_ROLE_KEY` — server only; never in Vite / Android client
- Publishable/anon key — unused for Model A writes; optional later for Model B reads
