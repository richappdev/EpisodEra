# Firebase Project Verification

Last verified: 2026-07-13

This document records the expected Firebase configuration for EpisodEra and how to re-check live project state.

## Expected project

| Setting | Value |
| --- | --- |
| Project ID | `episodera` |
| Default CLI project | `episodera` (`.firebaserc`) |
| Hosting URL | `https://episodera.web.app` |
| Auth domain | `episodera.firebaseapp.com` |
| Primary API URL | `https://api-m74gmd4u4a-uc.a.run.app` |
| Legacy Functions URL | `https://us-central1-episodera.cloudfunctions.net/api` |

Gen2 HTTPS functions deploy to Cloud Run. Both API URLs above should remain healthy during migration windows; production smoke and `docs/Deployment.md` use the Cloud Run URL as canonical.

## Configured services (repo)

| Service | Config file | Notes |
| --- | --- | --- |
| Cloud Functions (Gen2) | `firebase.json`, `functions/` | Single export: `api` (`nodejs22`, `us-central1`) |
| Firestore | `firestore.rules`, `firestore.indexes.json` | Admin SDK access from Functions only |
| Firebase Hosting | `firebase.json` | SPA from `web/dist` |
| Firebase Auth | Web SDK + Admin SDK | Email/password provider |
| Analytics | Web SDK | Requires `VITE_FIREBASE_MEASUREMENT_ID` |
| Performance Monitoring | Web SDK | Initialized at app startup |
| Emulators | `firebase.json` | Auth `9099`, Functions `5001`, Firestore `8080`, UI `4000` |

## Firestore ops checklist

| Item | Notes |
| --- | --- |
| Database | `(default)`, Standard Native, `asia-east1`, free tier |
| Usage | Console → Firestore → Usage |
| Billing | Set a GCP budget alert before leaving free tier |
| Delete protection | Enable on `(default)` once past experiments |
| Cost patterns | Cursor list APIs; `watchedEpisodeKeys` on progress; history `existsMany` for spoilers; `users/{uid}/derived/*` caches |

## Live endpoint checks (2026-07-13)

Automated HTTP checks from the agent environment:

| Endpoint | Result |
| --- | --- |
| `https://episodera.web.app` | HTTP 200 — SPA shell loads |
| `https://api-m74gmd4u4a-uc.a.run.app/health` | HTTP 200 — `{"ok":true}` |
| `https://us-central1-episodera.cloudfunctions.net/api/health` | HTTP 200 — `{"ok":true}` |

Console-only settings (enable manually in Firebase Console if not already set):

- Email/password sign-in provider enabled
- Google Analytics linked to the web app
- Performance Monitoring enabled for the web app
- Secret `TMDB_API_KEY` configured for Functions
- Production `CORS_ORIGINS` in `functions/.env.episodera`

## Verification script

From a machine with Node.js and Firebase CLI login:

```bash
cd functions
npm install
cd ..
node scripts/verify-firebase-project.mjs
```

The script checks:

- `.firebaserc` and `firebase.json` expectations
- Local Firebase CLI availability and login state
- Active project and registered app list (when authenticated)
- Production API and Hosting health endpoints

Optional overrides:

```bash
EXPECTED_PROJECT_ID=episodera \
PROD_API_BASE_URL=https://api-m74gmd4u4a-uc.a.run.app \
PROD_HOSTING_URL=https://episodera.web.app \
node scripts/verify-firebase-project.mjs
```

Exit code `0` means no hard failures. Warnings usually mean the CLI is not logged in on that machine.

## Manual CLI checks

```bash
npx -y firebase-tools@latest login:list
npx -y firebase-tools@latest use episodera
npx -y firebase-tools@latest apps:list --project episodera
npx -y firebase-tools@latest functions:secrets:access TMDB_API_KEY --project episodera
```

Do not commit secret values. Use the commands only to confirm presence and access.

## Drift watchlist

Re-run verification after:

- Firebase dependency upgrades (`docs/DependencyAudit.md`)
- Functions region or runtime changes
- Hosting domain or API URL changes
- App Check enforcement rollout (`docs/AppCheck.md`)
