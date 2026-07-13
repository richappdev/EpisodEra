# TV Time import tooling

Scripts and docs for migrating a TV Time GDPR export into EpisodEra.

User-specific data (exports, mappings, import CSVs) lives under `tv_time/` at the repo root and is gitignored.

## Prerequisites

1. Combined TV Time export in `tv_time/combined/` (from `tv_time_tool/combine_tv_time_exports.py`)
2. Network access (defaults to the deployed EpisodEra `/search` API), or a TMDb API key in repo-root `.env`:
   ```
   TMDB_API_KEY=your-key-here
   ```

## Step 0 — Combine exports (optional)

If you have multiple TV Time GDPR ZIP archives:

```powershell
py -3 tv_time_tool/combine_tv_time_exports.py path/to/primary.zip path/to/legacy.zip --primary path/to/primary.zip --output-dir tv_time/combined --output-zip tv_time/combined.zip
```

## Step 1 — Analyze export (optional)

```powershell
py -3 tv_time_tool/analyze_tv_time_export.py
```

Prints viewing summary stats without PII.

## Step 2 — Resolve show IDs

```powershell
py -3 tv_time_tool/resolve_tv_time_tmdb.py
```

Reads `tv_time/combined/normalized/shows.csv`, searches TMDb `/search/tv`, and writes:

| File | Purpose |
|------|---------|
| `tv_time/import/show_mapping.csv` | TV Time show ID → TMDb ID (review this) |
| `tv_time/import/unresolved_shows.csv` | Low-confidence or ambiguous matches |
| `tv_time/import/tmdb_search_cache.json` | Cached TMDb responses (safe to delete to refresh) |
| `tv_time/import/resolve_report.json` | Summary counts |

### Manual overrides

Edit `tv_time/import/show_overrides.csv` for spinoffs, remakes, or bad fuzzy matches:

```csv
tv_time_show_id,tmdb_id,note
75579,220542,Fullmetal Alchemist: Brotherhood (not 2003 series)
383837,79460,Shaman King (2021)
```

Re-run resolve; overrides take precedence over search.

## Step 3 — Generate import CSVs

```powershell
py -3 tv_time_tool/generate_episodera_import.py
```

Writes:

| File | EpisodEra target |
|------|------------------|
| `tv_time/import/episodes_import.csv` | `POST /progress/:showId/episodes/batch` |
| `tv_time/import/watchlist_import.csv` | `POST /watchlist` |
| `tv_time/import/skipped_episodes.csv` | Episodes excluded (unmapped show, season 0, etc.) |
| `tv_time/import/import_report.json` | Row counts and batch plan |
| `tv_time/import/batch_plan.json` | Per-show batch counts (API limit: 100 episodes/batch) |

### Import CSV columns

**episodes_import.csv**

- `tmdbId`, `mediaType`, `seasonNumber`, `episodeNumber`, `episodeKey`
- `watchedAt` — preserved from TV Time (`first_recorded_at`); API does not accept this yet
- `sourceShowId`, `sourceEpisodeId` — audit trail back to TV Time

**watchlist_import.csv**

- `itemId` (`tv_{tmdbId}`), `tmdbId`, `mediaType`, `title`, `poster`, `backdrop`, `status`
- Status: `watching` if episodes exist, else `planned`

## Step 4 — Import into EpisodEra

No bulk-import UI exists yet. Use authenticated API calls:

1. `POST /watchlist` for each row in `watchlist_import.csv`
2. `POST /progress/{tmdbId}/episodes/batch` in chunks of ≤100 per show (see `batch_plan.json`)

**Note:** The current API sets `watchedAt` to server time. Historical timestamps in `episodes_import.csv` are for reference only unless the API is extended or you use Admin SDK writes.

## Options

```
resolve_tv_time_tmdb.py
  --min-confidence 0.82   Auto-accept threshold (default 0.82)
  --refresh               Ignore TMDb search cache
  --api-key KEY           Use direct TMDb API instead of EpisodEra proxy
  --episodera-api URL     Use a specific EpisodEra API base URL

generate_episodera_import.py
  --min-confidence 0.82   Same threshold for accepted mappings
  --include-season-zero   Keep season 0 specials
  --include-episode-zero  Keep episode 0 rows
```

See also [TVTimeDataDesign.md](./TVTimeDataDesign.md) for schema and migration design notes.
