# TV Time Import Phase 1 Acceptance

Last updated: 2026-07-22
Canonical tip at checklist creation: `5a72102`  
Current repository tip (main): `3811117`
P0 hardening landed in `9a0420e`: A9 staging cleanup, A4 SHA-256 `sourceHash`, A5 session resume, smoke App Check + import path probes
Notion counterpart: [TV Time Data Schema Analysis](https://app.notion.com/p/39ca4181b628812e9792c7589cd14c5b)

## Purpose

Close Phase 1 as a **product gate**, not as “code exists.” Acceptance blocks Phase 2 `watchEvents` and further import UX expansion. A limited tracker beta may still ship without this gate, but import must not be marketed as complete until every criterion below is `PASS`.

GitHub is the evidence ledger. Notion remains the product-scope record and should mirror this checklist status.

**Document control:** Active repository SHA lives only on the Notion MVP Dashboard (and this ledger after each rebaseline). Child Notion pages must not invent competing baselines.

## Status summary

| Field | Value |
| --- | --- |
| Import Phase 1 **code** | Shipped (resolve, mapping review, stage, commit, run, staging cleanup, SHA-256 sourceHash, resume) |
| Phase 1 **acceptance** | **OPEN** |
| Gate outcome | Not closed |
| Blocking next | Phase 2 `watchEvents`; marketing “one-click TV Time migration” as complete |

### Criterion roll-up

| ID | Criterion | Status |
| --- | --- | --- |
| A1 | Tip-matched hosted Production Smoke | **OPEN** |
| A2 | Deployed import path evidence (resolve → mapping → stage → commit → run → cleanup) | **PARTIAL** (smoke fixture landed; needs tip-matched hosted PASS after Functions deploy) |
| A3 | ~4,744-episode soak | **OPEN** |
| A4 | Retries / duplicate runs idempotent | **PARTIAL** (SHA-256 sourceHash landed; production duplicate re-run evidence still needed) |
| A5 | Partial failures visible and recoverable | **PARTIAL** (sessionStorage resume for staged/running landed; downloadable report still P1) |
| A6 | Historical `watchedAt` preserved | **PARTIAL** (smoke fixture asserts date; soak spot-check still needed) |
| A7 | Unresolved / skipped records reported | **PARTIAL** |
| A8 | Browser-ZIP architecture decision recorded | **PASS** |
| A9 | Staging lifecycle cleanup policy implemented + verified | **PARTIAL** (delete-on-complete implemented; needs deployed smoke assert on `stagingClearedAt`) |

Acceptance closes only when **A1–A9 are all PASS**.

## Sample scale (reference archive)

From `tv_time_tool/TVTimeDataDesign.md` / Notion sample:

| Measure | Value |
| --- | ---: |
| Unique watched episodes | 4,744 |
| Shows | 153 |
| Approx. viewing hours | ~2,446 |
| History span | 2017-11-30 → 2026-07-08 |
| Rough Firestore writes (full migration) | ~10,000 |
| Season 0 specials | Excluded by default |
| Movies / ratings / emotions / lists | Out of Phase 1 acceptance |

## Architecture decision (A8) — recorded 2026-07-17

**Decision:** Accept **browser-side TV Time GDPR ZIP parsing** for Phase 1.

**Rationale:**

* Privacy: raw ZIP and auth/device/IP tables never leave the client as an uploaded blob.
* Matches shipped UI (`ImportTvTimePanel` + `tvTimeZip.ts`) and preferred Notion direction.
* Cloud Storage upload adds cost, retention, and App Check surface area without solving the active gate gaps (soak, lifecycle, tip smoke).

**Revisit if:** client memory fails on real archives, ZIP malware scanning becomes required, or multi-device resume requires server-held source bytes.

**Not accepted in Phase 1:** server-side ZIP upload to Cloud Storage as the primary path.

## Evidence ledger

### A1 — Tip-matched hosted Production Smoke

| Item | Evidence |
| --- | --- |
| Status | **OPEN** |
| Requirement | Hosted `Production Smoke` success whose workflow `headSha` equals the acceptance tip (or a tip explicitly rebaselined in this file + ResourceAlignment) |
| Latest hosted PASS | [run 29565696402](https://github.com/richappdev/EpisodEra/actions/runs/29565696402) on `5a9ecf9` (2026-07-17) |
| Current tip | `3811117` (P0 hardening landed in `9a0420e`; Daily Puzzle landed in `c06053b`) |
| Gap | No tip-matched hosted smoke for the current release candidate |
| Smoke coverage (local script) | Now includes App Check enforce probe + tiny import path + staging cleanup assert |

**Closeout action:** Deploy the current release candidate → dispatch Production Smoke on that tip → paste the run URL and short SHA here and on the MVP Dashboard.

### A2 — Deployed import path evidence

| Step | Code | Deployed evidence |
| --- | --- | --- |
| Resolve shows | `POST /me/imports/resolve-tv-time-shows` | Still needs full ZIP resolve on hosted (smoke uses pre-mapped tmdbId) |
| Persist mappings | `PUT /me/imports/media-mappings` | Unit/UI covered; hosted ZIP review still open |
| Create + stage | `POST /me/imports`, `/watchlist`, `/episodes` | Smoke fixture covers after Functions deploy |
| Commit + run | `POST .../commit`, `POST .../run` | Smoke fixture covers after Functions deploy |
| Cleanup staged rows | Delete on complete + `stagingClearedAt` | Smoke asserts after Functions deploy |

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Unit / component | `importLogic.test.ts`, `ImportTvTimePanel.test.tsx` (SHA-256 + resume), ZIP/CSV/build helpers |
| Production smoke | `web/scripts/production-smoke.mjs` now exercises `/me/imports/*` + `stagingClearedAt` (skip with `EPISODERA_SMOKE_SKIP_IMPORT_PATH_CHECK=true` against pre-A9 Functions) |
| Gap | Tip-matched hosted PASS after Functions deploy |

### A3 — ~4,744-episode soak

| Item | Evidence |
| --- | --- |
| Status | **OPEN** |
| Requirement | Full sample-scale (or equivalent ≥4k episode) import completes without timeout/data corruption; record importId, counts, duration, TMDb/Functions cost notes |
| In-repo artifacts | **None.** |
| Gap | No pass/fail record for the reference archive |

**Closeout action:** Run against a dedicated throwaway account; store a short evidence note here (no raw ZIP in git).

### A4 — Retries / duplicate runs idempotent

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Code | `sourceHash` is SHA-256 of ZIP bytes (or CSV payload); `importService.create` reuses jobs with matching hash in `draft`/`staged`/`running`/`completed`; progress OR-merges watched + earliest `watchedAt` |
| Tests | Component test asserts 64-char hex `sourceHash`; progress emulator idempotent counts |
| Gap | No recorded duplicate re-run of the same archive on production |

### A5 — Partial failures visible and recoverable

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Visible | Job counters `episodesSkipped` / `episodesFailed`; mapping review; skipped-title note on done |
| Recoverable | `sessionStorage` resume for `staged` / `running` after refresh (`importResume.ts`) |
| Gap | No downloadable skipped/failed report; draft mid-stage still requires re-upload |

### A6 — Historical `watchedAt` preserved

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Code | Import path writes historical `watchedAt`; merge keeps earliest |
| Smoke | Fixture episode uses `2019-06-15T12:00:00.000Z` and asserts progress date prefix |
| Gap | Soak archive spot-check ≥10 episodes across years |

### A7 — Unresolved / skipped records reported

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| UI | Review rows; done-state skipped titles; episode skip/fail counters |
| Gap | No exportable report; failed staged episode `skipReason` cleared with A9 staging delete (counters remain on job) |

### A8 — Browser-ZIP architecture

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Decision | See [Architecture decision](#architecture-decision-a8--recorded-2026-07-17) above |

### A9 — Staging lifecycle cleanup

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Policy | On successful `done`, delete `stagedShows` + `stagedEpisodes` in pages of 400; set `stagingClearedAt` + `stagingDocsDeleted` on the job doc |
| Code | `importService.clearStaging` called from `run()` when complete |
| Verification | Smoke asserts `stagingClearedAt` + `stagingDocsDeleted >= 1` after Functions deploy |
| Gap | Tip-matched hosted PASS |

## What is explicitly out of Phase 1 acceptance

* Movie import from TV Time
* Ratings, emotions, custom lists
* EpisodEra ZIP re-import
* Trakt / Serializd / other providers
* Push notifications / airing calendar
* Native apps
* Onboarding entry-point promotion (deferred until this gate closes)

## Closeout checklist (operator)

1. [x] Implement A9 staging cleanup (+ A4 SHA-256 + A5 resume) in code
2. [x] Land fixes on `main`; recorded as `9a0420e`
3. [ ] Deploy Functions (+ Hosting if needed); dispatch hosted Production Smoke on that tip → paste run URL (A1)
4. [ ] Confirm smoke import path + App Check enforce lines in the run log (A2/A9 + App Check)
5. [ ] Run ~4.7k soak on throwaway account; record counters + duration (A3, A6 spot-check)
6. [ ] Re-run same archive once; confirm idempotent (A4)
7. [ ] Confirm skipped/failed visibility after soak (A5, A7)
8. [ ] Mark all A1–A9 `PASS` in this file
9. [ ] Update `docs/ResourceAlignment.md` + Notion Dashboard / TV Time schema **Acceptance: Closed** with tip + date
10. [ ] Only then start Phase 2 `watchEvents`

## Related docs

* `docs/API.md` — `/me/imports/*`
* `docs/Firestore.md` — `imports/**`, `mediaMappings`
* `docs/ResourceAlignment.md` — product gate changelog
* `tv_time_tool/TVTimeDataDesign.md` — sample scale and design intent
* `tv_time_tool/README.md` — offline CSV helper path
