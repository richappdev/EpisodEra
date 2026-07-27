# Phase 9 — Native Supabase Auth (last)

> **Status:** Deferred
> **Authority:** Future Firebase Auth-to-Supabase Auth migration plan
> **Owner role:** Engineering and security
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [Security, Identity, and Access Boundaries](https://app.notion.com/p/3aaa4181b6288145b751ea32c22d7ecc)
> **Supersedes:** Auth steps embedded in the archived combined phase plan

Do **not** run until Postgres domains are at parity and soaked.

## Prep from a site export

```bash
node scripts/supabase/prepare-auth-cutover.mjs --from docs/supabase/evidence/site-export-...
# optional: write identity_mappings rows (email + firebase_uid only)
node scripts/supabase/prepare-auth-cutover.mjs --from <dir> --apply-mappings
```

Writes `auth-cutover/identity-mappings.json`, `.csv`, and `checklist.json` under the dump dir.

## Steps

1. Export Firebase Auth users (hash parameters preserved).
2. Import into Supabase Auth using official tooling.
3. Populate `private.identity_mappings.supabase_user_id`.
4. Remap application foreign keys from `firebase_uid` → `user_id uuid` in a dedicated migration window.
5. Switch Express middleware from Firebase `verifyIdToken` to Supabase JWT verification.
6. JIT fallback for failed password migrations.
7. Verify: signup/login/reset/deletion/revocation/cross-user denial.
8. Retire Firebase Auth after the migration window.

Official: https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth

## Rollback

Keep Firebase Auth accepting logins until soak metrics in `Phase0Baseline.md` are green. Dual Auth verification in Express can accept either token type during the window if needed.
