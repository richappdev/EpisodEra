# Android Client

Last updated: 2026-08-19

## Overview

Native Kotlin + Jetpack Compose client for EpisodEra. It reuses the existing HTTPS Functions API (`https://api-m74gmd4u4a-uc.a.run.app`) and Firebase Auth. User data is **not** read/written via the Firestore Android SDK.

| Item | Value |
| --- | --- |
| Package / applicationId | `com.episodera.app` |
| Firebase Android app | `1:388894496033:android:0ede2203c067dd17931a60` |
| Min SDK | 26 |
| Target / compile SDK | 35 |
| Project path | [`android/`](../android/) |

## Open in Android Studio

1. Install Android Studio (Ladybug or newer) with JDK 17.
2. **File → Open** → select `android/` (Gradle root), not the monorepo root.
3. Sync Gradle. First sync downloads the wrapper if needed.
4. Use an emulator or device with Google Play services (App Check / Auth).

Generate the Gradle wrapper from `android/` if missing:

```bash
gradle wrapper --gradle-version 8.9
```

Or open in Android Studio and let it create the wrapper.

## Configuration

- [`android/app/google-services.json`](../android/app/google-services.json) — Firebase Android SDK config (committed for this project).
- API base URL — `BuildConfig.API_BASE_URL` in [`android/app/build.gradle.kts`](../android/app/build.gradle.kts). Default production Cloud Run URL.
- Emulator Functions (optional): change debug `API_BASE_URL` to  
  `http://10.0.2.2:5001/episodera/us-central1/api` and disable App Check enforcement for local use.

## App Check

- **Release:** Play Integrity (`PlayIntegrityAppCheckProviderFactory`).
- **Debug:** Debug provider (`DebugAppCheckProviderFactory`). Register the debug token printed in Logcat under Firebase Console → App Check → Manage debug tokens.
- Requests send header `X-Firebase-AppCheck` (same as web). Align enforcement with [`AppCheck.md`](AppCheck.md).

## Modules

```text
android/
  app/                 Navigation, Firebase init, Remote Config kill-switch
  core/model/          API DTOs (mirror web/src/types)
  core/network/        Retrofit, interceptors, PreferencesStore, EpisodEraRepository
  core/design/         Cinema Memory theme + shared Compose widgets
  feature/*            Auth, Home, Search, Detail, Watchlist, Likes, Timeline,
                       Profile, Settings, Social, Puzzle, Franchises
```

## Feature parity (v1)

Shipped relative to web user features:

- Auth (email/password), Home, Search, Movie/TV detail (+ progress / watchlist / likes / discussions)
- Watchlist (Active / Continue Watching / Library), Likes, Timeline
- Profile (stats, Year Recap, achievements), Settings (language, providers, privacy, export, delete, TV Time import web handoff)
- Daily Puzzle (anonymous player id + signed-in stats), Franchises, Social
- Remote Config `site_access_blocked`, deep links (`episodera://` + `https://episodera.web.app`)
- Crashlytics / Analytics / Performance

**Web-only:** Admin puzzle studio (`/admin/puzzles`) and TV Time Import staging/run. Android can view imported Timeline, Progress, and Watch History after the web import finishes, but it does not run the import flow directly.

## Build

```bash
cd android
./gradlew testDebugUnitTest
./gradlew lintDebug
./gradlew :app:assembleDebug
./gradlew :app:bundleRelease
```

CI runs the combined release-governance baseline:

```bash
./gradlew testDebugUnitTest lintDebug :app:assembleDebug :app:bundleRelease --stacktrace
```

On Windows, use `gradlew.bat` with the same tasks.

## Release checklist

- [ ] Register Play Integrity in Firebase App Check for `com.episodera.app` before release smoke
- [ ] Upload signing key / Play App Signing and record the Play App Signing SHA-256
- [ ] Privacy policy URL (`https://episodera.web.app/privacy`)
- [ ] TMDb attribution visible in Settings
- [ ] Replace the placeholder SHA-256 in `web/public/.well-known/assetlinks.json`, deploy it to Hosting, and verify signed App Links for `episodera.web.app`
- [ ] Validate `:app:bundleRelease` in CI without publishing credentials
- [ ] Production App Check smoke with the release configuration
- [ ] Production smoke for the current source SHA: sign-in, watchlist add, mark episode, puzzle guess, and cleanup

## Related docs

- [`API.md`](API.md) — HTTP contracts
- [`Authentication.md`](Authentication.md) — ID tokens
- [`AppCheck.md`](AppCheck.md) — enforcement rollout
- [`CinemaMemoryDesign.md`](CinemaMemoryDesign.md) — visual tokens
- [`FirebaseProject.md`](FirebaseProject.md) — project IDs and API URLs
