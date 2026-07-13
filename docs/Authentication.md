# Authentication

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
6. Backend middleware verifies the token with Firebase Admin and attaches `req.user`.

## Backend behavior

- Discovery endpoints are public today and use optional auth.
- User-owned endpoints must use `requireAuth`.
- Firestore writes must use `req.user.uid` as the owner path.
- The backend should not trust user IDs sent in request bodies.

## Acceptance criteria

- Users can create an account with email/password.
- Users can sign in and sign out.
- Users can delete their account from Settings. Deletion calls `DELETE /me/account`, which removes all Firestore data under `users/{uid}` and deletes the Firebase Authentication user.
- Manual account-deletion validation passed on 2026-07-13 against the deployed app using a throwaway account. Confirmed `DELETE` confirmation UI, HTTP `204`, Firebase Auth user removal, and empty Firestore user data. The smoke automation account must not be used for deletion tests.
- Existing discovery and detail screens still work after sign-in.
- API requests include an ID token for signed-in users.
- Signed-out users can still browse public discovery pages.

## Future hardening

See `docs/AppCheck.md` for the phased App Check rollout plan (reCAPTCHA v3, monitor mode, enforced API routes).
