# Phase 10 — Retirement checklist

Do **not** enable these flags until Postgres soak is green and Auth cutover (Phase 9) is planned.

## Prep flags (default off)

```env
# FIRESTORE_WRITES_DISABLED=true
# SUPABASE_READ_PRIMARY=true
```

Helpers exist in `functions/src/config/env.ts` (`isFirestoreWritesDisabled`, `isSupabaseReadPrimary`). They are **not** globally enforced yet — flip only after domain read cutovers land.

## Order

1. Shadow writes stable; drain `private.migration_sync_failures`
2. Historical import parity OK (`export/` / site restore)
3. Switch reads domain-by-domain (`SUPABASE_READ_PROFILES`, later `SUPABASE_READ_PRIMARY`)
4. Phase 9 Auth cutover + soak
5. `FIRESTORE_WRITES_DISABLED` + Firebase read-only retention window
6. Remove Functions Firestore dependency / retire Auth after window
7. Hosting / Analytics can lag on Firebase

This repo never auto-deletes Firebase projects.
