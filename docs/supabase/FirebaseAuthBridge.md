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
node scripts/supabase/backfill-firebase-role-claim.mjs
```

### New users

Prefer Identity Platform **blocking functions** (`beforeUserCreated` / `beforeUserSignedIn`).  
Fallback: Auth `onCreate` + client `getIdToken(true)` immediately after signup.

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
- [ ] Claim backfill completed
- [ ] Staging query with Firebase JWT returns `authenticated` role
- [ ] `private.request_firebase_uid()` matches Firebase UID string
- [ ] Cross-user RLS denial test passes
