# Firebase → Supabase migration docs

> **Status:** Active
> **Authority:** Supabase documentation index
> **Owner role:** Engineering
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [Data Architecture — Supabase Primary / Firebase Services](https://app.notion.com/p/3aaa4181b6288109b9d8f86aaa3a6394)
> **Supersedes:** The feature-branch migration index

Project: [`xyhhnoxvydshqpypwccr`](https://xyhhnoxvydshqpypwccr.supabase.co)
Production state: Supabase-primary data plane; Firebase Auth and runtime services retained

| Doc | Purpose |
| --- | --- |
| [Phase0Baseline.md](./Phase0Baseline.md) | Counts, exports, rollback gates |
| [AccessBoundary.md](./AccessBoundary.md) | Model A API-first |
| [IdentityModel.md](./IdentityModel.md) | `firebase_uid` + mappings |
| [SchemaInventory.md](./SchemaInventory.md) | Firestore → Postgres map |
| [SchemaVsData.md](./SchemaVsData.md) | Migration vs ETL pipelines |
| [FirebaseAuthBridge.md](./FirebaseAuthBridge.md) | Third-party Auth + claims |
| [AuthMigration.md](./AuthMigration.md) | Phase 9 native Auth (last) |
| [RuntimePortability.md](./RuntimePortability.md) | Cloud Run API image |
| [Phase4to6.md](./Phase4to6.md) | Repository adapters + watchlist/likes shadow writes |
| [Phase7to10.md](./Phase7to10.md) | Progress/history/social shadow + Auth/retirement prep |
| [Cutover.md](./Cutover.md) | Flags to make Supabase the database of record |
| [Phase10Retirement.md](./Phase10Retirement.md) | Retirement flag order (do not flip early) |
| [SiteExportImport.md](./SiteExportImport.md) | Firebase dump → Supabase restore |
| [DefinitionOfDone.md](./DefinitionOfDone.md) | Per-domain checklist |

SQL source of truth: `supabase/migrations/`.
CLI helpers: `scripts/supabase/`.
