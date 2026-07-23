# Identity model

## Bridge phase (now → Phase 8)

| Concept | Type | Notes |
| --- | --- | --- |
| Firebase Auth UID | `text` | Opaque string; **not** a UUID |
| Ownership columns | `firebase_uid text` | All user-owned rows |
| RLS subject | `auth.jwt()->>'sub'` via `private.request_firebase_uid()` | Do not assume `auth.uid()` is uuid-safe for Firebase JWTs |
| Mapping table | `private.identity_mappings` | `supabase_user_id` null until Phase 9 |

## Phase 9 (native Supabase Auth)

1. Import Firebase users (preserve password hashes where possible).
2. Fill `identity_mappings.supabase_user_id`.
3. Add `user_id uuid` columns / remap FKs in a controlled migration.
4. Switch Express verification from Firebase Admin `verifyIdToken` to Supabase JWT.
5. Retire Firebase Auth after soak.

## Proof required on project `xyhhnoxvydshqpypwccr`

Before dual-write:

1. Register Firebase project `episodera` under Supabase Third-party Auth (CLI config already sets `[auth.third_party.firebase]`).
2. Backfill `role: authenticated` custom claims (`scripts/supabase/backfill-firebase-role-claim.mjs`).
3. Call a staging SQL check with a real Firebase ID token and document the JWT `sub` / role claims in `docs/supabase/evidence/` (gitignored).

Until that proof exists, treat identity as **designed but unverified against live Supabase**.
