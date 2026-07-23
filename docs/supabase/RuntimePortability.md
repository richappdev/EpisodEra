# Runtime portability (Express off Firebase Functions)

## Current state

- Express app: `functions/src/api/app.ts` (portable)
- Entrypoint: `functions/src/index.ts` (`onRequest` + `onSchedule`)
- Root `Dockerfile`: emulator/dev only

## Target

`Dockerfile.api` builds a production Node image that listens on `PORT` (Cloud Run / Render / Fly).

| Concern | Replacement |
| --- | --- |
| `defineSecret("TMDB_API_KEY")` | env / Secret Manager |
| `onSchedule` puzzle publish | Cloud Scheduler → HTTPS endpoint or Supabase cron |
| App Check | Keep while on Firebase; later Turnstile/WAF + API-only writes |
| In-memory rate limit | Redis / Upstash when multi-instance |
| Firestore Admin | Supabase service-role repositories |
| Emulator CI | `supabase db reset` + SQL tests + API contract tests |

## Local run (API image)

```bash
docker build -f Dockerfile.api -t episodera-api .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e TMDB_API_KEY=... \
  -e SUPABASE_URL=https://xyhhnoxvydshqpypwccr.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  episodera-api
```

Firebase Auth verification still requires Application Default Credentials or a service account when not using emulators.
