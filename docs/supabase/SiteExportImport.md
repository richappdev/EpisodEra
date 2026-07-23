# Firebase site export → Supabase restore

Portable backup for cutover / disaster recovery while Auth stays on Firebase.

## Flow

```text
Firebase (live)
   │  export-firebase-site.mjs
   ▼
site-export-<timestamp>/   (JSON dump, gitignored under evidence/)
   │  import-supabase-site.mjs
   ▼
Supabase Postgres (after migrations + project online)
```

Auth **passwords** are not restored by this path. Keep Firebase Auth (third-party bridge) or run Phase 9 Auth import separately.

## Export (from Firebase)

```bash
# Full site
node scripts/supabase/export-firebase-site.mjs

# One user / sample
node scripts/supabase/export-firebase-site.mjs --uid <FIREBASE_UID>
node scripts/supabase/export-firebase-site.mjs --limit 10 --out docs/supabase/evidence/smoke-dump
```

Requires Firebase Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS` or ADC).

### Dump layout

```text
site-export-.../
  manifest.json
  auth-users.json          # metadata only (no password hashes)
  franchises.json
  users/<uid>.json         # profile, settings, watchlist, likes, progress+episodes, history, friends
```

## Import (into Supabase)

Prerequisites:

1. Migrations applied (`npx supabase db push`)
2. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `functions/.env.supabase`
3. Dump directory from export

```bash
node scripts/supabase/import-supabase-site.mjs --from docs/supabase/evidence/site-export-... --dry-run
node scripts/supabase/import-supabase-site.mjs --from docs/supabase/evidence/site-export-...
node scripts/supabase/import-supabase-site.mjs --from <dir> --uid <FIREBASE_UID>
```

Import order per user: profile → settings → identity mapping → watchlist → likes → show_progress → watched_episodes → history → friendships (second pass).

## npm aliases

```bash
cd functions
npm run export:firebase-site
npm run import:supabase-site -- --from ../docs/supabase/evidence/site-export-...
```

## What is / is not included

| Included | Not included |
| --- | --- |
| Profiles, settings | Firebase password hashes (Phase 9) |
| Watchlist, likes | Imports staging jobs |
| Progress + episodes | Derived cache (recomputed) |
| History | Puzzle attempts / private answers (add later if needed) |
| Friends edges | Discussion moderation history |
| Franchise catalogs | TMDb live metadata |

## Recommended cutover use

1. Export from Firebase shortly before switch (or on a schedule).
2. Deploy Supabase schema + API.
3. `--dry-run` import, check counts vs `manifest.json`.
4. Real import.
5. Spot-check a few users in Supabase Table Editor.
6. Keep Firebase dump as rollback evidence under `docs/supabase/evidence/` (gitignored).
