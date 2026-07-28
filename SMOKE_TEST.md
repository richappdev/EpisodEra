# Episodera Production Smoke Tests

These Playwright smoke tests exercise the live production website:

```bash
https://episodera.web.app
```

They live in `web/tests/smoke` and use `web/playwright.smoke.config.ts`. The existing mocked local E2E tests in `web/tests/e2e` are unchanged.

## Coverage

Public smoke:

- Loads `/home`.
- Verifies the React shell is not blank.
- Checks primary navigation.
- Verifies at least one movie or TV card renders.
- Opens a detail page and checks title, poster or backdrop, metadata, and no visible application error.

Authenticated movie-lover journey:

- Signs in with a dedicated smoke account.
- Searches for a TV series.
- Opens the show detail page.
- Adds the show to the watchlist or accepts the existing saved state.
- Marks one unwatched episode watched, or verifies an existing watched episode when all visible episodes are already watched.
- Verifies progress in Continue Watching or Profile history.
- Verifies the show appears in Watchlist or Library.
- Searches for a movie and saves it to the watchlist.
- Optionally posts one natural discussion comment.
- Refreshes and verifies saved state persists.
- Creates a fresh browser context, signs in again, and verifies account state persists.
- Signs out.

Weekly comment journey:

- Signs in.
- Picks a suitable movie that does not appear to have an account comment.
- Adds it to the watchlist when needed.
- Marks it watched when needed so spoiler-safe discussion is eligible.
- Attempts one natural spoiler-safe comment.
- Skips or verifies existing comment state rather than duplicating recent account activity.
- Leaves all user data in place.

## Local Setup

Install dependencies and the Chromium browser:

```bash
cd web
npm ci
npx playwright install --with-deps chromium
```

Create `web/.env.smoke` from the example:

```bash
cp .env.smoke.example .env.smoke
```

Set these values:

```bash
EPISODERA_HOSTING_URL=https://episodera.web.app
EPISODERA_PROD_API_BASE_URL=https://api-m74gmd4u4a-uc.a.run.app
EPISODERA_TEST_EMAIL=smoke-test@example.com
EPISODERA_TEST_PASSWORD=replace-with-dedicated-smoke-password
```

If production App Check enforcement is enabled for API reads or writes, also set:

```bash
EPISODERA_SMOKE_APP_CHECK_BYPASS=replace-with-functions-smoke-bypass-secret
```

## Commands

Run the public smoke test:

```bash
cd web
npm run test:smoke:public
```

Run the authenticated journey:

```bash
cd web
npm run test:smoke:auth
```

Run public plus authenticated smoke:

```bash
cd web
npm run test:smoke
```

Run the weekly comment journey:

```bash
cd web
npm run test:smoke:comment
```

Run in headed mode:

```bash
cd web
npx playwright test --config=playwright.smoke.config.ts public-smoke.spec.ts --headed
```

Open the Playwright report:

```bash
cd web
npx playwright show-report playwright-report/smoke
```

## Environment Variables

Required for authenticated tests:

- `EPISODERA_TEST_EMAIL`
- `EPISODERA_TEST_PASSWORD`

Compatibility aliases:

- `EPISODERA_SMOKE_EMAIL`
- `EPISODERA_SMOKE_PASSWORD`

Optional:

- `EPISODERA_HOSTING_URL`: defaults to `https://episodera.web.app`.
- `EPISODERA_PROD_API_BASE_URL`: defaults to the deployed Cloud Functions API.
- `EPISODERA_SMOKE_APP_CHECK_BYPASS`: injects the Functions smoke bypass header for live browser API calls.
- `EPISODERA_ENABLE_COMMENTS`: must be `true` before the daily authenticated smoke can comment.
- `EPISODERA_COMMENT_PROBABILITY`: probability for eligible comment creation, default `0.20`.
- `EPISODERA_FORCE_COMMENT`: used by the weekly journey to make a deterministic comment attempt.

## Comment Behavior

Public smoke never comments.

The daily authenticated journey only attempts a comment when:

- `EPISODERA_ENABLE_COMMENTS=true`.
- The random probability check passes.
- The title has a visible discussion form.
- The generated wording is not duplicate or near-duplicate in local recent state.
- The selected title does not appear to already have a recent account comment.

The generated comment uses visible page context such as title, media type, genre, and synopsis. It avoids automation language and stays within roughly 12 to 45 words.

Duplicate prevention is best effort:

- Recent generated comment fingerprints are stored in `web/test-results/smoke-account-state.json`.
- Visible discussion comments are checked before posting.
- GitHub Actions restores and saves the recent-state file through an account-state cache.
- If duplicate prevention cannot safely choose a new comment, the test skips comment creation and logs why.

## Persistent Account Policy

The smoke account is treated as a long-term movie-lover profile.

Do not clear or reset:

- Watchlist entries
- Watched episodes
- Watch history
- Ratings, likes, reactions, or favorites
- Comments
- Profile activity
- Continue Watching progress

Tests must adapt to existing data. Already-saved titles, already-watched episodes, and prior comments are valid states.

## GitHub Setup

Required encrypted secrets for authenticated tests:

```text
EPISODERA_TEST_EMAIL
EPISODERA_TEST_PASSWORD
```

Optional encrypted secret:

```text
EPISODERA_SMOKE_APP_CHECK_BYPASS
```

Optional repository variables:

```text
EPISODERA_PROD_API_BASE_URL
EPISODERA_ENABLE_COMMENTS
EPISODERA_COMMENT_PROBABILITY
```

Daily workflow:

- File: `.github/workflows/episodera-smoke-test.yml`
- Manual dispatch.
- Pushes that modify smoke-test files.
- Every day at 08:00 Asia/Taipei: `0 0 * * *`.
- Every day at 20:00 Asia/Taipei: `0 12 * * *`.
- Public smoke always runs.
- Authenticated smoke runs only when credentials are configured.
- Comment creation is disabled for manual runs unless explicitly enabled.

Weekly comment workflow:

- File: `.github/workflows/episodera-weekly-comment.yml`
- Manual dispatch.
- Every Sunday at 20:30 Asia/Taipei: `30 12 * * 0`.

Both workflows use the `episodera-production-smoke` concurrency group so scheduled runs do not modify the shared account concurrently.

## Failure Artifacts

Artifacts are uploaded from:

```text
web/test-results/**
web/playwright-report/smoke/**
```

Playwright is configured for:

- Screenshot on failure.
- Trace on first retry.
- Video retained on failure.
- JSON, JUnit, list, and HTML reports.
- Browser diagnostics attachments with console errors, failed requests, 5xx responses, unauthorized API responses after login, current URL, and page errors.

The workflows also write `web/test-results/failure-notification.json` on failure so Slack, Discord, Teams, or email notification can be added later without changing test code.

## Troubleshooting

If public cards do not load:

```bash
cd web
EPISODERA_SMOKE_APP_CHECK_BYPASS=replace-with-secret npm run test:smoke:public
```

If sign-in fails, verify the account and secrets:

```bash
cd web
npm run test:smoke:auth -- --headed
```

If writes fail with unauthorized or forbidden API responses, verify that `EPISODERA_SMOKE_APP_CHECK_BYPASS` matches the deployed Functions `SMOKE_BYPASS_APP_CHECK_SECRET`.

If daily comments are skipped, inspect the Playwright attachments named `comment-skip`, `comment-existing`, or `comment-result`. Probability-based skipping is expected in the daily journey. The weekly journey must either post a new comment or verify an existing account comment.

If a title is already saved or an episode is already watched, this is expected persistent-account behavior. The test should continue and log the fallback.
