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
- Existing discovery and detail screens still work after sign-in.
- API requests include an ID token for signed-in users.
- Signed-out users can still browse public discovery pages.
