# Episodera Resource Alignment

Last updated: 2026-07-11

## Purpose

This document defines how Episodera’s implementation, planning, design, and presentation resources stay aligned across GitHub, Notion, Figma, and Canva.

GitHub is the implementation source of truth. Notion defines product scope, delivery priorities, testing expectations, and current project status. Figma defines the responsive interaction and component behavior expected from the application. Canva provides stakeholder-facing summaries and should reflect, but never override, the implementation and planning sources.

## Resource Map

| Resource | Role                                  | Source-of-truth scope                                                                                                      |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GitHub   | Implementation and technical behavior | Application code, Firebase functions, security rules, tests, CI, runtime configuration, and technical documentation        |
| Notion   | Product and delivery planning         | MVP scope, priorities, milestones, reliability plan, testing plan, blockers, and completion status                         |
| Figma    | Product interaction and responsive UI | Screens, components, navigation, layout behavior, loading states, error states, recovery behavior, and responsive patterns |
| Canva    | Stakeholder communication             | Product overview, design review, MVP status, reliability summaries, and presentation material                              |

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
* Movie and television detail views
* Authentication
* Watchlist management
* Season and episode browsing
* Individual episode watched and unwatched actions
* Season-level batch watched and unwatched actions
* Profile statistics
* Watched-history records
* Responsive navigation and layouts

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

1. Frontend component tests for critical UI and progress states
2. Playwright coverage for critical end-to-end user flows
3. Runtime validation against a staging Firebase environment
4. Accessibility validation, including keyboard flow, focus states, contrast, and touch-target checks
5. Offline and reconnect testing
6. Account lifecycle validation, including deletion and related user-data handling
7. Privacy and data-retention review
8. TMDb attribution and API-compliance verification
9. Observability, release monitoring, and rollback procedures
10. Final beta-readiness acceptance review

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

Cover:

* Loading, empty, and error panels
* Pending-write controls
* Disabled duplicate actions
* Retry behavior
* Rollback feedback
* Previous-episode dialog
* Batch progress UI
* Offline indicators

### End-to-end tests

Critical Playwright flows should include:

* Sign up and sign in
* Search and open detail
* Add and remove watchlist item
* Mark one episode watched
* Create and resolve a watched-progress gap
* Mark a season watched
* Reverse a season progress action
* Verify next-unwatched guidance
* Recover from a failed write
* Verify responsive navigation on mobile

### Runtime validation

Staging validation should confirm:

* Firebase emulator and deployed behavior are consistent
* Security rules behave as expected
* Authentication redirects are correct
* TMDb requests and attribution are compliant
* Environment variables are correctly configured
* Offline and reconnect states behave predictably

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
| GitHub implementation | Core MVP and backend reliability work substantially implemented; frontend and runtime validation remain                 |
| Notion planning       | MVP hardening, testing priorities, and beta blockers updated                                                            |
| Figma design          | Responsive screen system and core states documented; additional reliability-state synchronization may still be required |
| Canva reporting       | MVP scope and reliability language updated; unsupported claims and placeholders removed                                 |

## Known Integration Constraints

At the time of this update:

* Automated GitHub write access may fail with `403 Resource not accessible by integration`.
* Figma write operations may be blocked when the connected Starter plan reaches its MCP tool-call limit.

These limitations affect resource synchronization only. They do not change product scope or implementation status.

## Review Cadence

Review this document when:

* A milestone is completed
* A critical user flow changes
* Reliability behavior changes
* A release candidate is created
* Beta readiness is assessed
* A source-of-truth conflict is discovered

The project should also perform a full GitHub, Notion, Figma, and Canva alignment review before public beta and before production release.
