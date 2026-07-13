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
functions: npm ci && npm test && npm run test:coverage && npm run lint
functions emulator: setup Java && npm run test:emulator
web: npm ci && npm run build && npm run test:components && npm run test:coverage && npx playwright install --with-deps chromium && npm run test:e2e
```

Backend coverage uses Node's built-in test coverage thresholds. Frontend component coverage uses Vitest, React Testing Library, and V8 coverage thresholds over the currently tested UI surfaces. The Playwright critical-flow and reliability tests run against a deterministic mocked API and test-only signed-in auth mode. They do not require live Firebase credentials.

## Production smoke validation

After deployment, run the opt-in signed-in smoke test with a dedicated automation account:

```plain text
cd web
cp .env.smoke.example .env.smoke
# Replace placeholder values in .env.smoke, then:
npm run smoke:prod:local
```

Alternatively, export the variables directly:

```plain text
cd web
EPISODERA_FIREBASE_API_KEY=...
EPISODERA_SMOKE_EMAIL=...
EPISODERA_SMOKE_PASSWORD=...
EPISODERA_PROD_API_BASE_URL=https://api-m74gmd4u4a-uc.a.run.app
npm run smoke:prod
```

`EPISODERA_PROD_API_BASE_URL` defaults to the current deployed API URL and `EPISODERA_SMOKE_SHOW_ID` defaults to `125988`. The smoke test signs in through Firebase Auth REST, validates `/health`, profile read/update, TV detail, watchlist add/status/remove, episode progress write/read/remove, stats, and history. The script cleans up its watchlist item and watched episode before exiting.

### GitHub Actions smoke workflow

The `Production Smoke` workflow at `.github/workflows/smoke.yml` runs the same signed-in deployed validation in GitHub Actions.

Triggers:

- Manual dispatch from the Actions tab (`workflow_dispatch`)
- Weekly schedule: Mondays at 06:00 UTC

Required repository secrets:

- `EPISODERA_FIREBASE_API_KEY`
- `EPISODERA_SMOKE_EMAIL`
- `EPISODERA_SMOKE_PASSWORD`

Optional manual-dispatch inputs:

- `api_base_url` (defaults to the current deployed API URL)
- `smoke_show_id` (defaults to `125988`)

The workflow writes a run summary with commit SHA, API URL, show ID, duration, and workflow run link. Store that evidence in Notion for release candidates. For approval gates, attach the secrets to a protected GitHub environment and point the workflow job at that environment.

## Pre-deploy checklist

- `docs/CodingStandard.md` reviewed for current conventions
- `docs/DependencyAudit.md` reviewed and release risk accepted or resolved
- `functions`: `npm run build`
- `functions`: `npm run test:coverage`
- `web`: `npm run build`
- `web`: `npm run test:components`
- `web`: `npm run test:coverage`
- `web`: `npm run test:e2e`
- `web`: `npm run smoke:prod` with a dedicated automation account after deploy
- Firebase Authentication email/password provider enabled
- Firebase Analytics enabled and `VITE_FIREBASE_MEASUREMENT_ID` configured
- Firebase Performance Monitoring enabled for the web app
- `TMDB_API_KEY` secret configured
- Firestore rules deployed
- Production `VITE_API_BASE_URL` points to the deployed function
- Firebase Hosting deployed from `web/dist`
