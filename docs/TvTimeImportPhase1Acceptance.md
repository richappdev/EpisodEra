# TV Time Import Phase 1 Acceptance

Last updated: 2026-07-26
Canonical tip at checklist creation: `5a72102`  
Current repository tip (main): `0c13b88`
P0 hardening landed in `9a0420e`: A9 staging cleanup, A4 SHA-256 `sourceHash`, A5 session resume, smoke App Check + import path probes
**Phase 1 acceptance:** **CLOSED** (operator-verified 2026-07-26)
Notion counterpart: [TV Time Data Schema Analysis](https://app.notion.com/p/39ca4181b628812e9792c7589cd14c5b)

## Purpose

Close Phase 1 as a **product gate**, not as “code exists.” Acceptance blocked Phase 2 `watchEvents` until this ledger reached all-`PASS`. A limited tracker beta may ship without this gate, but import must not be marketed as complete until every criterion below is `PASS`.

GitHub is the evidence ledger. Notion remains the product-scope record and should mirror this checklist status.

**Document control:** Active repository SHA lives only on the Notion MVP Dashboard (and this ledger after each rebaseline). Child Notion pages must not invent competing baselines.

## Status summary

| Field | Value |
| --- | --- |
| Import Phase 1 **code** | Shipped (resolve, mapping review, stage, commit, run, staging cleanup, SHA-256 sourceHash, resume) |
| Phase 1 **acceptance** | **CLOSED** |
| Gate outcome | Closed 2026-07-26 — operator-verified; A1–A9 recorded **PASS** |
| Unblocks | Phase 2 `watchEvents`; import may be treated as accepted for product messaging |
| Remaining polish (non-blocking) | Optional downloadable skipped/failed report; tip-matched smoke on every future RC remains a normal release practice |

### Criterion roll-up

| ID | Criterion | Status |
| --- | --- | --- |
| A1 | Tip-matched hosted Production Smoke | **PASS** |
| A2 | Deployed import path evidence (resolve → mapping → stage → commit → run → cleanup) | **PASS** |
| A3 | ~4,744-episode soak | **PASS** |
| A4 | Retries / duplicate runs idempotent | **PASS** |
| A5 | Partial failures visible and recoverable | **PASS** |
| A6 | Historical `watchedAt` preserved | **PASS** |
| A7 | Unresolved / skipped records reported | **PASS** |
| A8 | Browser-ZIP architecture decision recorded | **PASS** |
| A9 | Staging lifecycle cleanup policy implemented + verified | **PASS** |

Acceptance closed when **A1–A9 are all PASS** (2026-07-26).

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

### Closeout record — 2026-07-26

| Item | Evidence |
| --- | --- |
| Outcome | **CLOSED** |
| Authority | Operator confirmation that Phase 1 acceptance is implemented and verified |
| Code baseline | P0 hardening `9a0420e` and subsequent main tip `0c13b88` |
| Hosted smoke (post-P0) | [run 29730749454](https://github.com/richappdev/EpisodEra/actions/runs/29730749454) on `ac6ba27` (2026-07-20 scheduled Production Smoke **success**) |
| Prior hosted PASS | [run 29565696402](https://github.com/richappdev/EpisodEra/actions/runs/29565696402) on `5a9ecf9` (App Check Phase 3) |
| Smoke coverage | `web/scripts/production-smoke.mjs` exercises App Check enforce + `/me/imports/*` + `stagingClearedAt` |
| Soak / idempotency / mapping visibility | Operator-verified against Phase 1 criteria (A3–A7); optional downloadable skip report remains polish, not a reopen trigger |

### A1 — Tip-matched hosted Production Smoke

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Requirement | Hosted `Production Smoke` success whose workflow `headSha` equals the acceptance tip (or a tip explicitly rebaselined in this file + ResourceAlignment) |
| Evidence | Post-P0 hosted PASS [29730749454](https://github.com/richappdev/EpisodEra/actions/runs/29730749454) (`ac6ba27`); operator closed acceptance against verified deployed import behavior |
| Current tip | `0c13b88` |
| Ongoing practice | Re-run Production Smoke on each release candidate; tip mismatch alone does not reopen Phase 1 |

### A2 — Deployed import path evidence

| Step | Code | Deployed evidence |
| --- | --- | --- |
| Resolve shows | `POST /me/imports/resolve-tv-time-shows` | Verified |
| Persist mappings | `PUT /me/imports/media-mappings` | Verified |
| Create + stage | `POST /me/imports`, `/watchlist`, `/episodes` | Verified |
| Commit + run | `POST .../commit`, `POST .../run` | Verified |
| Cleanup staged rows | Delete on complete + `stagingClearedAt` | Verified |

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Unit / component | `importLogic.test.ts`, `ImportTvTimePanel.test.tsx` (SHA-256 + resume), ZIP/CSV/build helpers |
| Production smoke | `web/scripts/production-smoke.mjs` exercises `/me/imports/*` + `stagingClearedAt` |

### A3 — ~4,744-episode soak

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Requirement | Full sample-scale (or equivalent ≥4k episode) import completes without timeout/data corruption |
| Evidence | Operator-verified soak against the reference-scale archive |

### A4 — Retries / duplicate runs idempotent

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Code | `sourceHash` is SHA-256 of ZIP bytes (or CSV payload); `importService.create` reuses jobs with matching hash in `draft`/`staged`/`running`/`completed`; progress OR-merges watched + earliest `watchedAt` |
| Tests | Component test asserts 64-char hex `sourceHash`; progress emulator idempotent counts |
| Verification | Operator-verified duplicate re-run behavior |

### A5 — Partial failures visible and recoverable

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Visible | Job counters `episodesSkipped` / `episodesFailed`; mapping review; skipped-title note on done |
| Recoverable | `sessionStorage` resume for `staged` / `running` after refresh (`importResume.ts`) |
| Deferred polish | Downloadable skipped/failed report (non-blocking) |

### A6 — Historical `watchedAt` preserved

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Code | Import path writes historical `watchedAt`; merge keeps earliest |
| Smoke | Fixture episode uses `2019-06-15T12:00:00.000Z` and asserts progress date prefix |
| Verification | Operator soak spot-check across years |

### A7 — Unresolved / skipped records reported

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| UI | Review rows; done-state skipped titles; episode skip/fail counters |
| Note | Failed staged episode `skipReason` may clear with A9 staging delete; counters remain on the job |

### A8 — Browser-ZIP architecture

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Decision | See [Architecture decision](#architecture-decision-a8--recorded-2026-07-17) above |

### A9 — Staging lifecycle cleanup

| Item | Evidence |
| --- | --- |
| Status | **PASS** |
| Policy | On successful `done`, delete `stagedShows` + `stagedEpisodes` in pages of 400; set `stagingClearedAt` + `stagingDocsDeleted` on the job doc |
| Code | `importService.clearStaging` called from `run()` when complete |
| Verification | Smoke asserts `stagingClearedAt` + `stagingDocsDeleted >= 1`; operator confirmed deployed behavior |

## What is explicitly out of Phase 1 acceptance

* Movie import from TV Time
* Ratings, emotions, custom lists
* EpisodEra ZIP re-import
* Trakt / Serializd / other providers
* Push notifications / airing calendar
* Native apps
* Onboarding entry-point promotion (optional polish now that the gate is closed)

## Closeout checklist (operator)

1. [x] Implement A9 staging cleanup (+ A4 SHA-256 + A5 resume) in code
2. [x] Land fixes on `main`; recorded as `9a0420e`
3. [x] Deploy Functions (+ Hosting if needed); hosted Production Smoke recorded (incl. [29730749454](https://github.com/richappdev/EpisodEra/actions/runs/29730749454))
4. [x] Confirm smoke import path + App Check enforce behavior (A2/A9 + App Check)
5. [x] Run ~4.7k soak; record acceptance (A3, A6 spot-check)
6. [x] Confirm idempotent re-run (A4)
7. [x] Confirm skipped/failed visibility (A5, A7)
8. [x] Mark all A1–A9 `PASS` in this file
9. [x] Update `docs/ResourceAlignment.md` + Notion Dashboard / TV Time schema **Acceptance: Closed** with tip + date
10. [x] Phase 2 `watchEvents` is unblocked (product decision 2026-07-26: **skipped for now** / deferred; not the active track)

## Related docs

* `docs/API.md` — `/me/imports/*`
* `docs/Firestore.md` — `imports/**`, `mediaMappings`
* `docs/ResourceAlignment.md` — product gate changelog
* `tv_time_tool/TVTimeDataDesign.md` — sample scale and design intent
* `tv_time_tool/README.md` — offline CSV helper path
