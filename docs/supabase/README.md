# Firebase → Supabase migration docs

Project: [`xyhhnoxvydshqpypwccr`](https://xyhhnoxvydshqpypwccr.supabase.co)  
Branch: `feature/supabase-foundation`

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
| [SiteExportImport.md](./SiteExportImport.md) | Firebase dump → Supabase restore |
| [DefinitionOfDone.md](./DefinitionOfDone.md) | Per-domain checklist |

SQL source of truth: `supabase/migrations/`.  
CLI helpers: `scripts/supabase/`.
