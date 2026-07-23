# Firebase Auth → Supabase third-party bridge

## Config in repo

`supabase/config.toml`:

```toml
[auth.third_party.firebase]
enabled = true
project_id = "episodera"
```

Also enable the integration in the Supabase dashboard for project `xyhhnoxvydshqpypwccr`.

## Custom claim requirement

Firebase JWTs need:

```json
{ "role": "authenticated" }
```

Without it, Supabase treats the caller as `anon`.

### Existing users

```bash
# Requires Firebase Admin credentials
node scripts/supabase/backfill-firebase-role-claim.mjs --dry-run
node scripts/supabase/backfill-firebase-role-claim.mjs
```

### New users

Deployed Cloud Function `onUserCreatedSetSupabaseRole` (`functions/src/authOnCreateClaims.ts`) sets the claim on signup.

Because `onCreate` is async, call `getIdToken(true)` once after first signup if the first token lacks `role`.

Optional: Identity Platform blocking functions in `functions/src/authClaims.ts` for synchronous claims.

## Prove the bridge

```bash
# 1) Sign in on web/emulator, copy the Firebase ID token
# 2) Ensure migration firebase_uid_probe is pushed
# 3) Run:
node scripts/supabase/prove-firebase-jwt.mjs --token "<FIREBASE_ID_TOKEN>"
```

Requires `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` in `functions/.env.supabase`.

## Client pattern (Model B / JWT tests only)

```ts
const supabase = createClient(url, publishableKey, {
  accessToken: async () =>
    (await firebaseAuth.currentUser?.getIdToken(false)) ?? null,
});
```

Model A Express continues to use `firebase-admin` `verifyIdToken` and the Supabase **service role**.

## Proof checklist

- [ ] Dashboard third-party Auth shows Firebase `episodera`
- [ ] Claim backfill completed for existing users
- [ ] `onUserCreatedSetSupabaseRole` deployed (or blocking functions)
- [ ] `prove-firebase-jwt.mjs` exits 0 for a real token
- [ ] Cross-user RLS denial tested when Model B reads are enabled
