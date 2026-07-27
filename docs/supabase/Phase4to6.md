# Phase 4–6 — Repository Adapters + Shadow Dual-Write (archived)

> **Status:** Archived
> **Authority:** Historical implementation record
> **Owner role:** Engineering
> **Archived:** 2026-07-27
> **Final source baseline:** `a325fdd`
> **Notion counterpart:** [Episodera Firebase → Supabase Migration Assessment (archived)](https://app.notion.com/p/3a5a4181b62881fa969af954b500ffc5)
> **Superseded by:** [`Cutover.md`](Cutover.md) and [`SchemaInventory.md`](SchemaInventory.md)

This page describes the former Firestore-primary shadow-write phase. It is historical and must not be used as the current production configuration.

## Phase 4 — Repository adapters

Contracts live under `functions/src/repositories/`.

Live writes still go through existing services (`profileService`, `settingsService`, `watchlistService`, `likesService`). After Firestore succeeds, services call `shadowWrite()` → Supabase writers.

```text
Route → Service (Firestore primary)
              └── shadowWrite → supabaseWriters → PostgREST (service role)
                                 └── failures → record_migration_sync_failure RPC
```

## Phase 5 — Low-risk domains

| Domain | Behaviour |
| --- | --- |
| Profiles | Shadow upsert on `profileService.update` |
| Settings | Shadow upsert on `settingsService.update` |
| Profile reads | Still Firestore unless `SUPABASE_READ_PROFILES=true` |
| Franchises | Use site import / seed (no request-path dual-write) |
| Ratings | Skipped (not productized) |

## Phase 6 — Watchlist + likes shadow mode

| Concern | Behaviour |
| --- | --- |
| Primary write | Firestore (unchanged API) |
| Shadow write | Supabase when `SUPABASE_SHADOW_WRITES=true` |
| Reads | Firestore |
| Secondary failures | `private.migration_sync_failures` via RPC (never silent) |

Covered operations: watchlist add / status / remove / import-merge; likes add / remove.

## Enable (Functions env / `.env.episodera`)

```env
SUPABASE_URL=https://xyhhnoxvydshqpypwccr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_SHADOW_WRITES=true
# Step 3 — domain reads from Supabase (Firestore fallback if missing/stub):
SUPABASE_READ_PROFILES=true
SUPABASE_READ_SETTINGS=true
SUPABASE_READ_WATCHLIST=true
```

Also apply migration `20260723150001_record_migration_sync_failure.sql`:

```bash
npx supabase db push
```

## Preconditions before enabling shadow

1. Schema migrations applied (done).
2. Historical backfill / `import-supabase-site` for existing users (so FK `profiles` rows exist).
3. Auth bridge proof (Phase 2) recommended before relying on JWT RLS; shadow uses service role so it can run earlier.

## Not in Phase 4–6

- Progress/history dual-write / reads → see [Phase7to10.md](./Phase7to10.md)
- Native Supabase Auth (Phase 9)
