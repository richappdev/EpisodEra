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
VITE_FIREBASE_MEASUREMENT_ID=...
```

Then build:

```plain text
cd web
npm run build
```

## Web hosting deployment

Firebase Hosting serves the built Vite app from `web/dist`.

Deploy the web app with:

```plain text
firebase deploy --only hosting
```

The app is an SPA, so all routes rewrite to `index.html`.

## Firebase app monitoring

Enable these Firebase products for the registered web app before deploying the production build:

- Google Analytics: enable Google Analytics for the Firebase project, then copy the web app `measurementId` into `VITE_FIREBASE_MEASUREMENT_ID`.
- Performance Monitoring: enable Performance Monitoring for the web app in Firebase Console. The web client initializes `firebase/performance` at startup and sends page-load and network request metrics when the browser supports the SDK.
- Web exceptions: the web client logs uncaught `error` and `unhandledrejection` events as Google Analytics `exception` events.

Firebase Crashlytics does not currently provide a Web SDK. Add Crashlytics when native Apple, Android, Flutter, or Unity clients are introduced; for the current web client, use Analytics exception events or a dedicated browser error-reporting service.

## Continuous Integration

GitHub Actions runs the baseline MVP regression on pushes to `main` and on pull requests:

```text
functions: npm ci && npm test && npm run lint
web: npm ci && npm run build
```

The `functions` test script currently compiles TypeScript through `npm run build`. Add runtime integration tests to the workflow once the Firestore emulator environment is ready.

## Pre-deploy checklist

- `docs/CodingStandard.md` reviewed for current conventions
- `docs/DependencyAudit.md` reviewed and release risk accepted or resolved
- `functions`: `npm run build`
- `web`: `npm run build`
- Firebase Authentication email/password provider enabled
- Firebase Analytics enabled and `VITE_FIREBASE_MEASUREMENT_ID` configured
- Firebase Performance Monitoring enabled for the web app
- `TMDB_API_KEY` secret configured
- Firestore rules deployed
- Production `VITE_API_BASE_URL` points to the deployed function
- Firebase Hosting deployed from `web/dist`
