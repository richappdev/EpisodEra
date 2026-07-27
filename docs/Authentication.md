# Authentication

> **Status:** Active
> **Authority:** Firebase identity and API authentication contract
> **Owner role:** Engineering and security
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [Security, Identity, and Access Boundaries](https://app.notion.com/p/3aaa4181b6288145b751ea32c22d7ecc)
> **Supersedes:** Firebase-database ownership assumptions

## Goal

Use Firebase Authentication as the single identity provider for the MVP. The web app signs users in with email/password and sends Firebase ID tokens to the Cloud Functions API.

## Firebase project

- Project: `episodera`
- Local API default: `http://127.0.0.1:5001/episodera/us-central1/api`
- Frontend config is loaded from Vite environment variables.

## Required web environment

```plain text
VITE_API_BASE_URL=http://127.0.0.1:5001/episodera/us-central1/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=episodera.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=episodera
VITE_FIREBASE_APP_ID=...
```

For local emulator development, also set:

```plain text
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
```

When `VITE_USE_FIREBASE_EMULATORS=true`, the web client connects Firebase Auth to the Auth emulator (`9099`) instead of the live `episodera` project. Use any email/password in the emulator UI; accounts are local only.

## Local emulator flow

1. Start emulators from `functions/`:

```bash
npm run serve
```

This starts Auth (`9099`), Functions (`5001`), Firestore (`8080`), and the Emulator UI (`4000`).

2. Configure `web/.env` from `web/.env.example` with `VITE_USE_FIREBASE_EMULATORS=true`.

3. Start the web app:

```bash
cd web
npm run dev
```

4. Sign up or sign in against the Auth emulator. The Functions emulator verifies emulator-issued ID tokens automatically when started via the Emulator Suite.

Do not set `VITE_USE_FIREBASE_EMULATORS=true` in production builds.

## Required backend secret

```plain text
firebase functions:secrets:set TMDB_API_KEY
```

For local emulator runs, provide the secret through the Firebase emulator secret flow or local environment before starting functions.

## Current MVP flow

1. User opens the web app.
2. Firebase initializes from `VITE_FIREBASE_*`.
3. User signs up or signs in with email/password.
4. The app listens to Firebase auth state.
5. API calls include `Authorization: Bearer <idToken>` when a user is signed in.
6. When configured, the web client also attaches `X-Firebase-AppCheck` (reCAPTCHA v3).
7. Backend middleware verifies the ID token with Firebase Admin and attaches `req.user`.
8. Backend `optionalAppCheck` verifies App Check tokens in monitor mode. When `APP_CHECK_ENFORCE_AUTH_WRITES=true`, `requireAppCheck` rejects protected routes without a valid App Check token.

## Backend behavior

- Discovery endpoints are public today and use optional auth.
- User-owned endpoints must use `requireAuth` (and `requireAppCheck` when Phase 3 enforcement is enabled).
- Product writes must use `req.user.uid` as the Supabase ownership key through the API. Retained Firestore rollback writes use the same Firebase UID.
- The backend should not trust user IDs sent in request bodies.

## Acceptance criteria

- Users can create an account with email/password.
- Users can sign in and sign out.
- Users can delete their account from Settings. Deletion calls `DELETE /me/account`, which removes Supabase-owned product data, clears explicitly owned discussion/puzzle rows, removes any retained Firestore user tree when applicable, and deletes the Firebase Authentication user.
- Manual account-deletion validation passed on 2026-07-13 against the then-current deployed Firebase data plane. Post-cutover deletion must also verify Supabase-owned rows. The smoke automation account must not be used for deletion tests.
- Existing discovery and detail screens still work after sign-in.
- API requests include an ID token for signed-in users.
- Signed-out users can still browse public discovery pages.

## App Check

See `docs/AppCheck.md` for the phased rollout. Phase 2 (backend monitor) and Phase 3 (enforce on `requireAuth` routes behind `APP_CHECK_ENFORCE_AUTH_WRITES`) are implemented in Functions. Public-read enforcement remains Phase 4.
