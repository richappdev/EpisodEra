# Phase 9 — Native Supabase Auth (last)

Do **not** run until Postgres domains are at parity and soaked.

## Steps

1. Export Firebase Auth users (hash parameters preserved).
2. Import into Supabase Auth using official tooling.
3. Populate `private.identity_mappings.supabase_user_id`.
4. Remap application foreign keys from `firebase_uid` → `user_id uuid` in a dedicated migration window.
5. Switch Express middleware from Firebase `verifyIdToken` to Supabase JWT verification.
6. JIT fallback for failed password migrations.
7. Verify: signup/login/reset/deletion/revocation/cross-user denial.
8. Retire Firebase Auth after the migration window.

## Rollback

Keep Firebase Auth accepting logins until soak metrics in `Phase0Baseline.md` are green. Dual Auth verification in Express can accept either token type during the window if needed.
