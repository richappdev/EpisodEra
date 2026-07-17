# Episodera Resource Alignment

Last updated: 2026-07-14

## Purpose

This document defines how Episodera's implementation, planning, design, and presentation resources stay aligned across GitHub, Notion, Figma, and Canva.

GitHub is the implementation source of truth. Notion defines product scope, delivery priorities, testing expectations, and current project status. Figma defines the responsive interaction and component behavior expected from the application. Canva provides stakeholder-facing summaries and should reflect, but never override, the implementation and planning sources.

## Resource Map

| Resource | Role                                  | Source-of-truth scope                                                                                                      |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GitHub   | Implementation and technical behavior | Application code, Firebase functions, security rules, tests, CI, runtime configuration, and technical documentation        |
| Notion   | Product and delivery planning         | MVP scope, priorities, milestones, reliability plan, testing plan, blockers, and completion status                         |
| Figma    | Product interaction and responsive UI | Screens, components, navigation, layout behavior, loading states, error states, recovery behavior, and responsive patterns |
| Canva    | Stakeholder communication             | Product overview, design review, MVP status, reliability summaries, and presentation material                              |

## GitHub Alignment Document

This file is the repository-local resource alignment reference. It should be kept in sync with the Notion alignment report whenever cross-resource status changes.

The Notion report remains the planning and decision record. This GitHub document records the implementation-facing interpretation of that report, including current technical status, validation expectations, and the source-of-truth rules that agents and maintainers should apply while changing the codebase.

When the Notion alignment report and this file disagree:

1. Use GitHub code and technical docs as the implementation authority.
2. Use Notion as the product-scope and delivery-priority authority.
3. Update whichever resource is stale, or explicitly record the conflict as a migration task.

## Canonical Product Scope

Episodera is a responsive web application for discovering movies and television shows, maintaining a watchlist, tracking episode progress, and reviewing profile statistics and viewing history.

The MVP platform is a browser-based application built with:

* React 18
* TypeScript
* Vite
* Firebase
* TMDb

The MVP supports:

* English
* Traditional Chinese
* Desktop, tablet, and mobile responsive layouts

Native mobile applications are post-MVP and must not be presented as part of the current supported release target.

## Current MVP Capabilities

The currently implemented or substantially implemented product areas include:

* Trending movie and television discovery
* Search across movie and television content
* Movie and television detail views with shareable URLs (React Router 6)
* Authentication
* User profile read/update (`GET/PATCH /me/profile`)
* Watchlist management
* Season and episode browsing
* Individual episode watched and unwatched actions
* Season-level batch watched and unwatched actions
* Continue Watching with backend-calculated next-unwatched episode
* Profile statistics
* Watched-history records
* Settings (language, previous-episode preference)
* Public privacy policy (`/privacy`) with bilingual disclosures
* Account deletion (`DELETE /me/account` and Settings confirmation UI)
* Responsive navigation and layouts
* Domain hooks (`useWatchlist`, `useProgress`, `useProfile`, `useProfileStats`, `useSettings`) with independent section loading, error, and retry
* Paginated list APIs and load-more UI for watchlist, profile history, and discovery trending/search

## Reliability Work Implemented

The MVP hardening work has added or defined the following reliability behavior:

* Canonical TMDb episode metadata validation
* Atomic progress and history writes
* Batch episode progress operations
* Canonical next-unwatched episode calculation
* Idempotent or duplicate-resistant progress actions
* Emulator-backed backend validation
* Firebase security-rules testing
* Java-backed CI support for emulator tests
* Frontend component tests for key page state, controls, and localized settings behavior
* Signed-in Playwright critical-flow coverage for the core watchlist/progress path
* Expanded Playwright coverage: progress gaps, season batch writes, failed/offline recovery, duplicate-action prevention, concurrent browser consistency, responsive-shell and accessibility smoke
* Production smoke runner (`npm run smoke:prod`, `npm run smoke:prod:local`) with negative deployed checks (invalid auth, CORS rejection, rate-limit `429`)
* GitHub Actions `Production Smoke` workflow (manual dispatch and weekly schedule)
* Backend and frontend coverage enforcement in CI
* CORS allowlist, structured logging, payload/batch limits, and per-instance rate limiting
* Pending-write states
* Duplicate-action prevention
* Recoverable error handling
* Retry actions
* Offline feedback
* Optimistic-update rollback messaging
* Previous-episode decision handling when progress contains gaps

The implementation must remain the final authority for whether each capability is complete.

## Remaining MVP Hardening Priorities

The highest-priority remaining work is:

1. Repeat hosted `Production Smoke` on future release candidates and retain workflow evidence (latest hosted: `c97b0c3` — [workflow run 29303301272](https://github.com/richappdev/EpisodEra/actions/runs/29303301272); prior: `031cb35` — [workflow run 29232556051](https://github.com/richappdev/EpisodEra/actions/runs/29232556051))
2. Staging Firebase environment separation and staging-specific smoke validation (optional)
3. Broader WCAG-focused accessibility audit beyond current Playwright smoke assertions
4. Real-auth deployed E2E cases (signup, token refresh/expiry, deleted-account session, sign-out during write)
5. Legal review of privacy policy copy and formal TMDb terms/image compliance checklist
6. Dependency major-upgrade and production-risk decision (`firebase-admin`, `firebase-functions`, Vite)
7. App Check Phase 2+ backend monitor/enforcement and distributed quota evaluation beyond per-Functions-instance rate limits
8. Observability dashboards, release monitoring, and rollback procedures
9. Final beta-readiness acceptance review

Account lifecycle implementation is complete (`DELETE /me/account`, Settings UI, emulator test). Manual throwaway-account deletion validation passed on 2026-07-13. Do not delete the smoke automation account during smoke runs.

A feature should not be marked complete solely because its normal-path UI exists.

## Required UI States

Figma and the frontend implementation should remain aligned on the following states.

### General data states

* Initial loading
* Section-level loading
* Empty results
* Recoverable error
* Retry in progress
* Permission denied
* Signed-out state
* Offline state
* Reconnecting state

### Progress-write states

* Idle
* Pending
* Success
* Failure with rollback
* Duplicate action blocked
* Partial batch failure
* Retry available

### Episode-progress behavior

The canonical next-unwatched episode is the earliest available episode not marked as watched according to the validated episode sequence.

The interface must not assume that the highest watched episode means all earlier episodes were watched.

When a user marks an episode as watched while earlier episodes remain unwatched, the interface should support an explicit previous-episode choice rather than silently filling gaps.

Season-level batch operations should expose progress, prevent duplicate submissions, and handle partial failures without presenting an incorrect completed state.

## Responsive Design Requirements

The supported layout targets are:

* Desktop: 1024px and above
* Tablet: 768px to 1023px
* Mobile: 767px and below

The application should maintain:

* A maximum content width of approximately 1180px
* Single-column mobile content flow where appropriate
* Touch targets of at least 44px
* No required horizontal scrolling for core workflows
* Persistent or clearly accessible primary navigation
* Equivalent product functionality across supported breakpoints

Responsive design changes must preserve behavior, not only visual appearance.

## Testing Alignment

The test strategy should cover four layers.

### Backend unit and integration tests

Cover:

* Canonical episode validation
* Next-unwatched calculation
* Progress updates
* History creation
* Batch operations
* Idempotency
* Partial failure
* Authorization
* Security rules

### Frontend component tests

Implemented:

* Loading, empty, and error panels
* Signed-out states
* Detail page watchlist and episode controls
* Watchlist saved count, Continue Watching next episode, status, remove, and next-episode controls
* Profile stats and recent history
* Settings language, previous-episode preference, privacy link, and account-deletion confirmation flow
* Trending/search tab, submit, no-result, and API-error states
* Top-bar auth/navigation states

Still needed:

* Deeper component coverage for retry/rollback messaging and offline indicators where not already covered by Playwright

### End-to-end tests

Critical Playwright flows should include:

Implemented (deterministic mocked/API-controlled suite):

* Signed-in deterministic auth state
* Search and open detail
* Add a watchlist item and change TV watchlist status to Watching
* Mark one episode watched and verify next-unwatched guidance
* Verify profile and history consistency; unmark one episode
* Verify protected data clears after sign-out
* Continue Watching gap resolution
* Season batch watched/unwatched writes
* Failed/offline progress-write recovery and duplicate-action prevention during pending writes
* Concurrent browser progress consistency
* Responsive shell and accessibility smoke (desktop and mobile), including TMDb footer attribution

Still needed:

* Sign up and sign in against a real deployed Firebase Auth environment
* Randomized soak/performance coverage with console and network telemetry
* Full cross-browser coverage beyond Chromium

### Runtime validation

Recorded evidence (2026-07-13):

* Local production smoke passed at `2e8e6c3` via `npm run smoke:prod:local`
* Local production smoke passed at `a5205f6` via `npm run smoke:prod:local` (invalid auth, CORS `403`, rate-limit `429` verified)
* Hosted GitHub Actions `Production Smoke` passed at `a8537b0` via `workflow_dispatch`
* Negative deployed checks verified locally after CORS deploy at `df849b2`
* Privacy/account deletion deployed with `6acb749` / `3419172`; Functions and Hosting released to `https://episodera.web.app`

Still required on future release candidates:

* Repeat hosted smoke for the exact release commit SHA and archive workflow URL in Notion
* Staging-environment smoke if a distinct staging Firebase project is introduced
* Firebase emulator and deployed behavior remain consistent for new changes
* Security rules, auth redirects, env configuration, and offline/reconnect behavior under staging/production targets
* Formal TMDb terms/image compliance sign-off

## Cross-Resource Update Rules

### When GitHub changes

A meaningful implementation change should trigger review of:

* Notion status and milestone pages
* Notion testing plans
* Figma interaction states
* Canva stakeholder summaries
* This alignment document

Examples include:

* New user-visible features
* Changed progress behavior
* New API contracts
* Security-rule changes
* New failure or recovery behavior
* Scope removal or deferral

### When Notion changes

A scope or priority change should be checked against:

* Existing GitHub implementation
* Open GitHub issues
* Figma screen coverage
* Canva status language

Notion must not mark an item complete unless the implementation or verification evidence supports it.

### When Figma changes

A design change should identify:

* The affected route or component
* Required frontend behavior
* New states or edge cases
* Accessibility impact
* Responsive impact
* Whether tests need to be added or changed

Figma should not introduce unsupported product capabilities without a corresponding Notion scope decision.

### When Canva changes

Canva content must:

* Use factual implementation status
* Avoid fabricated metrics
* Avoid unsupported adoption, revenue, satisfaction, or engagement claims
* Avoid placeholder names, phone numbers, emails, and URLs
* Distinguish implemented, in progress, pending, and post-MVP work
* Match the canonical web-MVP scope

Canva is explanatory material, not a planning or implementation source of truth.

## Status Language

Use these definitions consistently.

### Implemented

The functionality exists in the codebase and has meaningful supporting validation.

### In progress

Implementation has started, but expected behavior, testing, integration, or deployment validation remains incomplete.

### Designed

The behavior is documented in Figma but is not necessarily implemented.

### Planned

The work is approved in Notion but has not started.

### Pending validation

Implementation exists, but staging, accessibility, security, compliance, or end-to-end verification remains incomplete.

### Post-MVP

The capability is intentionally outside the current release scope.

## Definition of Done

A feature is complete only when all applicable conditions are met:

* Scope is documented
* Implementation is merged
* Error and recovery behavior is defined
* Responsive behavior is verified
* Accessibility requirements are checked
* Relevant unit, integration, component, or end-to-end tests pass
* Security implications are reviewed
* Analytics or observability requirements are addressed
* Notion status is updated
* Figma reflects final behavior
* Canva does not contradict the delivered state
* Runtime or staging verification is complete where required

## Current Resource Status

| Resource              | Current status                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GitHub implementation | Tip `aeda075` (2026-07-17): App Check Phase 2 monitor deployed (Functions); Phase 3 enforce still off (`APP_CHECK_ENFORCE_AUTH_WRITES` unset). `friendCode` Admin-write-only in rules. TV Time import Phase 1 **code** shipped; **acceptance** still needs tip-matched hosted smoke evidence + soak/lifecycle/ZIP-arch. |
| Notion planning       | Re-baseline to `aeda075` after recording local tip smoke PASS; hosted Production Smoke workflow evidence still recommended for release gate |
| Figma design          | Responsive screen system documented; direct latest-file verification pending when connector access allows |
| Canva reporting       | Should distinguish implemented code, recorded smoke evidence, and beta-ready status; refresh after hosted smoke reruns |

## Known Integration Constraints

At the time of this update:

* The previous GitHub documentation update blocker is resolved for this repository because `docs/ResourceAlignment.md` has been added locally.
* Future automated GitHub connector writes may still fail with `403 Resource not accessible by integration`; when that happens, update the repository directly and record the local file path.
* Figma write operations may still be blocked when the connected Starter plan reaches its MCP tool-call limit.

These limitations affect resource synchronization only. They do not change product scope or implementation status.

## Change Log
### 2026-07-17 (App Check Phase 2 deploy + friendCode rules)

* Tip `aeda075` on `main` / `origin/main`: App Check backend monitor + Phase 3 flag, `friendCode` locked in Firestore rules, `build:prod` requires reCAPTCHA site key.
* Deployed `functions` + `firestore:rules` to `episodera` with enforcement **off** (monitor-only).
* Local production smoke **PASS** at tip against `https://api-m74gmd4u4a-uc.a.run.app` (invalid auth / CORS / rate-limit verified).
* Next: set prod App Check site key in Hosting build, then enable `APP_CHECK_ENFORCE_AUTH_WRITES` + smoke bypass; finish TV Time Phase 1 acceptance (hosted smoke evidence, soak, lifecycle, ZIP-arch).

### 2026-07-15 (rebaseline to b147545 — Phase 1 closeout gate)

* Canonical tip set to `b147545` on `main` / `origin/main`.
* Notion parent MVP, Firestore schema, TV Time Data Schema, Alignment, Reliability, UI Testing, and UX plan re-baselined; Firestore hierarchy corrected to include `imports/**` with TMDb-centric staged keys + top-level `mediaMappings/**`.
* Product decision: **close Phase 1** (tip-matched hosted smoke + import deployed checks, ~4.7k soak, browser-ZIP architecture decision, staging lifecycle cleanup) **before** Phase 2 `watchEvents` or more UX work.
* Parallel gates unchanged: App Check Phase 2+, WCAG depth, deps, observability, rollback. Bundle/Vite cleanup must not displace import acceptance.

### 2026-07-15 (TV Time import Phase 1 — mapping review + mediaMappings)

* Feature tip `7fe1df9` (web API client allows `PUT` for media-mappings upsert); tip later advanced to `b147545`.

* Shipped in-app mapping review for unmatched/ambiguous TV Time shows; user picks persist to Firestore `mediaMappings/{provider}_{mediaType}_{externalId}` via `PUT /me/imports/media-mappings` (Cloud Functions only writes).
* ZIP resolve (`POST /me/imports/resolve-tv-time-shows`) consults shared overrides; Settings import flow includes review UI before staging/commit/run.
* Product status: TV Time import Phase 1 **code** shipped; acceptance (smoke/soak/lifecycle/arch decision) open before Phase 2 `watchEvents`.

### 2026-07-15 (baseline bump to 1d5ca30 + import track)

* Canonical tip set to `1d5ca30` after UX Phases 1–6 (`c85fdcc` … `9c866fa` + hardening).
* Notion parent MVP + Firestore schema re-baselined; local Production Smoke **PASS** at tip against live API (core paths).
* Hosted Production Smoke **PASS** via [workflow run 29399200238](https://github.com/richappdev/EpisodEra/actions/runs/29399200238) on `origin/main` `0518525` (~18s).
* Product decision: next feature track is **TV Time import** (Data Schema Phase 1); UX polish deferred to optional backlog.
* Hardening remains parallel: App Check Phase 2+, legal/deps, observability.

### 2026-07-14 (baseline bump to d4c4402)

* Canonical GitHub/Notion baseline set to tip `d4c4402` (records hosted smoke pass for `c97b0c3`).
* Clarified that latest hosted Production Smoke is `c97b0c3` ([workflow run 29303301272](https://github.com/richappdev/EpisodEra/actions/runs/29303301272)); `031cb35` is prior evidence only.
* Marked App Check client (Phase 0–1) as shipped; Phase 2+ backend enforce remains open.
* Refreshed AI Implementation Plan as non-blocking with matching SHA.

### 2026-07-14 (hosted smoke for c97b0c3)

* Hosted `Production Smoke` **PASS** at `c97b0c3` via [workflow run 29303301272](https://github.com/richappdev/EpisodEra/actions/runs/29303301272) (`workflow_dispatch` on tag `smoke-c97b0c3`).
* Archived workflow URL on Notion parent plan, UI Testing Plan, Reliability Plan, and Alignment Report.

### 2026-07-13 (Phase E proceed — App Check + section-failure tests)

* Marked Phase D complete: domain hooks, pagination, independent section loading/error/retry (`b16cf7f` / `d125bda`).
* Bumped canonical baseline to `be7a6d4`; hosted smoke rerun for Phase D+ SHAs remains the top release gate.
* Started App Check Phase 0–1 client integration per `docs/AppCheck.md`.
* Added Playwright per-section failure/recovery coverage for watchlist vs profile and history vs stats independence.

### 2026-07-13 (alignment drift correction)

* Processed Notion drift review: removed contradictory hosted-smoke-pending callouts, reframed UI Testing P0, qualified Reliability Plan Phase D loading/error state, bumped canonical baseline to `2480170`, patched Alignment Report API list and account-lifecycle table, unified tagline wording.
* Updated `README.md` emulator-CI wording to reflect hosted CI configuration.

### 2026-07-13

* Synchronized with Notion alignment review through commit `2480170`.
* Marked privacy policy, account deletion, URL routing, expanded Playwright coverage, production smoke, negative deployed checks, and coverage enforcement as implemented.
* Updated remaining priorities to focus on hosted smoke reruns, staging separation, domain hooks, pagination, WCAG depth, compliance review, dependency decisions, and observability.
* Recorded runtime smoke evidence for commits `2e8e6c3`, `a5205f6`, `a8537b0`, `df849b2`, local `031cb35`, and hosted `031cb35` ([workflow run](https://github.com/richappdev/EpisodEra/actions/runs/29232556051), PASS ~23s).

### 2026-07-11

* Added `docs/ResourceAlignment.md` as the GitHub-side alignment reference.
* Marked the prior GitHub resource-alignment documentation blocker as resolved for the repository.
* Kept Figma reliability-state synchronization listed as an external access limitation until the connected plan allows more MCP write operations.

## Review Cadence

Review this document when:

* A milestone is completed
* A critical user flow changes
* Reliability behavior changes
* A release candidate is created
* Beta readiness is assessed
* A source-of-truth conflict is discovered

The project should also perform a full GitHub, Notion, Figma, and Canva alignment review before public beta and before production release.
