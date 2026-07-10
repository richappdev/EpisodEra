# Deployment

## Firebase project

Project ID: `episodera`

```plain text
firebase use episodera
```

## Backend deployment

Set the TMDb secret before deploying functions:

```plain text
firebase functions:secrets:set TMDB_API_KEY
firebase deploy --only functions
```

The exported function is:

```plain text
api
```

Expected deployed API shape:

```plain text
https://us-central1-episodera.cloudfunctions.net/api
```

## Firestore deployment

Deploy rules and indexes with:

```plain text
firebase deploy --only firestore
```

## Web build

Create a production web environment with:

```plain text
VITE_API_BASE_URL=https://us-central1-episodera.cloudfunctions.net/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=episodera.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=episodera
VITE_FIREBASE_APP_ID=...
```

Then build:

```plain text
cd web
npm run build
```

## Continuous Integration

GitHub Actions runs the baseline MVP regression on pushes to `main` and on pull requests:

```text
functions: npm ci && npm test
web: npm ci && npm run build
```

The `functions` test script currently compiles TypeScript through `npm run build`. Add linting and runtime integration tests to the workflow once the ESLint 9 config and Firestore emulator environment are ready.

## Pre-deploy checklist

- `functions`: `npm run build`
- `web`: `npm run build`
- Firebase Authentication email/password provider enabled
- `TMDB_API_KEY` secret configured
- Firestore rules deployed
- Production `VITE_API_BASE_URL` points to the deployed function
