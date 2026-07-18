# TV Time Import Phase 1 Acceptance

Last updated: 2026-07-18  
Canonical tip at checklist creation: `5a72102`  
Current repository tip: `b71473e` (rebaseline acceptance tip at closeout)  
Notion counterpart: [TV Time Data Schema Analysis](https://app.notion.com/p/39ca4181b628812e9792c7589cd14c5b)

## Purpose

Close Phase 1 as a **product gate**, not as “code exists.” Acceptance blocks Phase 2 `watchEvents` and further import UX expansion. A limited tracker beta may still ship without this gate, but import must not be marketed as complete until every criterion below is `PASS`.

GitHub is the evidence ledger. Notion remains the product-scope record and should mirror this checklist status.

## Status summary

| Field | Value |
| --- | --- |
| Import Phase 1 **code** | Shipped (resolve, mapping review, stage, commit, run) |
| Phase 1 **acceptance** | **OPEN** |
| Gate outcome | Not closed |
| Blocking next | Phase 2 `watchEvents`; marketing “one-click TV Time migration” as complete |

### Criterion roll-up

| ID | Criterion | Status |
| --- | --- | --- |
| A1 | Tip-matched hosted Production Smoke | **OPEN** |
| A2 | Deployed import path evidence (resolve → mapping → stage → commit → run → cleanup) | **PARTIAL** |
| A3 | ~4,744-episode soak | **OPEN** |
| A4 | Retries / duplicate runs idempotent | **PARTIAL** |
| A5 | Partial failures visible and recoverable | **PARTIAL** |
| A6 | Historical `watchedAt` preserved | **PARTIAL** |
| A7 | Unresolved / skipped records reported | **PARTIAL** |
| A8 | Browser-ZIP architecture decision recorded | **PASS** |
| A9 | Staging lifecycle cleanup policy implemented + verified | **OPEN** |

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
| Current tip | `b71473e` (ahead of smoke `5a9ecf9` and prior ledger tips `5f00677` / `5a72102`) |
| Stale Notion baseline | `b147545` is an ancestor of tip; **do not** require exact `b147545` smoke anymore — rebaseline tip when closing |
| Gap | No tip-matched hosted smoke for `b71473e` (or successor chosen at closeout) |
| Also note | Current `web/scripts/production-smoke.mjs` does **not** call `/me/imports/*` (see A2) |

**Closeout action:** Dispatch Production Smoke on the chosen tip; paste run URL + short SHA into this section and ResourceAlignment.

### A2 — Deployed import path evidence

| Step | Code | Deployed evidence |
| --- | --- | --- |
| Resolve shows | `POST /me/imports/resolve-tv-time-shows` | **None recorded** |
| Persist mappings | `PUT /me/imports/media-mappings` | **None recorded** |
| Create + stage | `POST /me/imports`, `/watchlist`, `/episodes` | **None recorded** |
| Commit + run | `POST .../commit`, `POST .../run` | **None recorded** |
| Cleanup staged rows | Not implemented | **N/A until A9** |

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Unit / component | `importLogic.test.ts`, `tvTimeResolveLogic.test.ts`, `ImportTvTimePanel.test.tsx`, ZIP/CSV/build helpers |
| Production smoke | Does **not** exercise import routes (`/health`, profile, watchlist, progress, stats, history only) |
| Gap | No hosted or signed-in production log proving resolve → mapping → stage → commit → run on the live API |

**Closeout action:** Either extend `smoke:prod` with a tiny fixture import (preferred, repeatable) **or** attach a dated manual production run log (account, importId, counters) for the tip SHA.

### A3 — ~4,744-episode soak

| Item | Evidence |
| --- | --- |
| Status | **OPEN** |
| Requirement | Full sample-scale (or equivalent ≥4k episode) import completes without timeout/data corruption; record importId, counts, duration, TMDb/Functions cost notes |
| In-repo artifacts | **None.** `web/e2e-run.log` is a 10-minute **UI** regression soak (2026-07-13), not import. |
| Gap | No pass/fail record for the reference archive |

**Closeout action:** Run against a dedicated throwaway account; store a short evidence note here (no raw ZIP in git). Capture: tip SHA, `episodesImported` / `episodesSkipped` / `episodesFailed`, wall time, whether tab stayed open for the full `run` loop.

### A4 — Retries / duplicate runs idempotent

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Code | `importService.create` reuses jobs with matching `sourceHash` in `draft`/`staged`/`running`/`completed`; `progressService.importWatchedEpisodes` OR-merges watched + earliest `watchedAt` |
| Tests | Progress emulator idempotent counts; `importLogic` earliest-`watchedAt` unit test |
| Gap | Client fingerprint is `${watchlist.length}:${episodes.length}:${firstWatchlistTmdb}:${firstEpisodeTmdb}` — **not** ZIP SHA-256 — so distinct archives can collide and true resume-by-file is weak (`ImportTvTimePanel.tsx`) |
| Gap | No recorded duplicate re-run of the same archive on production |

**Closeout action:** Switch `sourceHash` to SHA-256 of ZIP bytes (or normalized CSV payload); prove create returns same `importId` / no duplicate progress on second run; attach counters.

### A5 — Partial failures visible and recoverable

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Visible | Job counters `episodesSkipped` / `episodesFailed`; mapping review for unmatched/ambiguous shows; skipped-title note on done |
| Recoverable | Mapping review before staging; re-run while job is `running`/`staged` |
| Gap | Frontend `while (!done)` requires the Settings tab to stay open — refresh loses in-flight orchestration (job may still exist server-side, but UI does not resume) |
| Gap | No downloadable skipped/failed report |

**Closeout action:** Resume-by-`importId` after refresh (minimum for acceptance); downloadable report may remain P1 if counters + staged `failed` docs are inspectable.

### A6 — Historical `watchedAt` preserved

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| Code | Import path writes historical `watchedAt`; merge keeps earliest |
| Tests | `importLogic` earliest timestamp unit test |
| Gap | No tip-level archive proof that timeline dates match TV Time `first_recorded_at` sample |

**Closeout action:** Spot-check ≥10 episodes across years from the soak import against source CSV; note sample keys in this file.

### A7 — Unresolved / skipped records reported

| Item | Evidence |
| --- | --- |
| Status | **PARTIAL** |
| UI | Review rows for unresolved shows; done-state skipped title list; episode skip/fail counters |
| Gap | No exportable report; failed staged episode `skipReason` not surfaced in UI |

**Closeout action:** At minimum, surface failed episode count + reason summary after soak; optional CSV download can stay P1.

### A8 — Browser-ZIP architecture

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Decision | See [Architecture decision](#architecture-decision-a8--recorded-2026-07-17) above |

### A9 — Staging lifecycle cleanup

| Item | Evidence |
| --- | --- |
| Status | **OPEN** |
| Design intent | Delete or TTL staged rows after successful import (`TVTimeDataDesign.md`) |
| Code today | On `done`, job → `completed` + `completedAt`; staged docs remain with `imported`/`failed` flags — **no delete/TTL** |
| Account delete | `DELETE /me/account` removes `imports/**` with the user tree — not post-import cleanup |
| Gap | Policy not implemented; no verification |

**Closeout action:** Implement post-complete staged cleanup (or documented short retention + sweeper); prove with before/after doc counts on a test importId.

## What is explicitly out of Phase 1 acceptance

* Movie import from TV Time
* Ratings, emotions, custom lists
* EpisodEra ZIP re-import
* Trakt / Serializd / other providers
* Push notifications / airing calendar
* Native apps
* Onboarding entry-point promotion (deferred until this gate closes)

## Closeout checklist (operator)

Use this sequence; check boxes only with linked evidence.

1. [ ] Implement A9 staging cleanup (and preferably A4 SHA-256 + A5 resume) if still OPEN at run time
2. [ ] Land fixes on `main`; record tip short SHA here
3. [ ] Dispatch hosted Production Smoke on that tip → paste run URL (A1)
4. [ ] Run deployed import path evidence (smoke extension or manual log) (A2)
5. [ ] Run ~4.7k soak on throwaway account; record counters + duration (A3, A6 spot-check)
6. [ ] Re-run same archive once; confirm idempotent (A4)
7. [ ] Confirm skipped/failed visibility after soak (A5, A7)
8. [ ] Mark all A1–A9 `PASS` in this file
9. [ ] Update `docs/ResourceAlignment.md` + Notion TV Time Data Schema **Acceptance: Closed** with tip + date
10. [ ] Only then start Phase 2 `watchEvents`

## Related docs

* `docs/API.md` — `/me/imports/*`
* `docs/Firestore.md` — `imports/**`, `mediaMappings`
* `docs/ResourceAlignment.md` — product gate changelog
* `tv_time_tool/TVTimeDataDesign.md` — sample scale and design intent
* `tv_time_tool/README.md` — offline CSV helper path
