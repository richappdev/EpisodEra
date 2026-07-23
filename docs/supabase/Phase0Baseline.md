# Phase 0 — Firebase baseline before Supabase cutover

Capture this evidence before dual-write or Auth bridge production use.

## Project references

| System | Value |
| --- | --- |
| Firebase project ID | `episodera` |
| Supabase project URL | `https://xyhhnoxvydshqpypwccr.supabase.co` |
| Supabase project ref | `xyhhnoxvydshqpypwccr` |
| Branch for foundation work | `feature/supabase-foundation` |

## Open Firebase hardening (must close or explicitly waive)

From `docs/Firestore.md` and `docs/TvTimeImportPhase1Acceptance.md`:

- [ ] TV Time import Phase 1 acceptance: hosted smoke + soak evidence (A4/A5/A9)
- [ ] Production smoke baseline recorded for signed-in critical flows
- [ ] App Check Phase 3 enforce confirmed live (`APP_CHECK_ENFORCE_AUTH_WRITES=true`)
- [ ] Account deletion orphan policy decision (discussions / puzzleAttempts / userGameStats)

## Record counts checklist

Run against production (Admin SDK or Console) and store results in `docs/supabase/evidence/` (gitignored raw dumps; keep summary here).

| Collection / path | Count | Captured at | Notes |
| --- | --- | --- | --- |
| Auth users | | | |
| `users` | | | |
| watchlist (all users) | | | |
| likes | | | |
| progress docs | | | |
| progress episodes | | | |
| history | | | |
| settings | | | |
| friends | | | |
| imports | | | |
| franchises | | | |
| puzzlePublic | | | |
| puzzlePrivate | | | |
| puzzleAttempts | | | |
| userGameStats | | | |

## Export artifacts

| Artifact | Script | Status |
| --- | --- | --- |
| Auth users + hash params | `scripts/supabase/export-firebase-auth.mjs` | Ready (dry-run safe) |
| Representative Firestore sample | `scripts/supabase/export-firestore-sample.mjs` | Ready |
| API response fixtures | Reuse Playwright / unit fixtures under `functions/` and `web/` | Existing |

## Rollback metrics (cutover gates)

Abort or roll back domain cutover if any threshold is exceeded within the soak window:

| Metric | Threshold | Action |
| --- | --- | --- |
| Auth failure rate | > 1% of login attempts | Revert Auth bridge / keep Firebase-only |
| Progress write error rate | > 0.5% | Keep Firestore primary; stop shadow writes |
| Dual-write outbox backlog | Growing > 1h without drain | Pause dual-write; investigate |
| Parity mismatch (watchlist/progress) | Any unresolved after reconciliation job | Block read switch |
| p95 API latency regression | > 2× baseline | Investigate before next domain |

## Schema freeze

During active dual-write of a domain, do not change that domain’s Firestore shape or Postgres migration without a paired dual-write update. Prefer landing schema migrations on `feature/supabase-foundation` before enabling shadow writes.

## Exit condition

Phase 0 is complete when counts are captured, export scripts run successfully against a non-prod or read-only context, rollback metrics are agreed, and remaining MVP acceptance items are closed or explicitly waived in writing.
