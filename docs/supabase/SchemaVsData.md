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

Raw dumps belong under `docs/supabase/evidence/` (gitignored).
