# Episodera Documentation Register

> **Status:** Active
> **Authority:** Repository documentation index and lifecycle policy
> **Owner role:** Engineering and product leads
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [Documentation Register](https://app.notion.com/p/3aaa4181b6288185a042c7a737db3434)
> **Supersedes:** The active portions of `ResourceAlignment.md`

GitHub is authoritative for implementation, APIs, schemas, migrations, tests, and deployment commands. Notion is authoritative for product definition, priorities, release gates, and navigable business/engineering summaries.

## Business & Product

- [Cinema Memory design](CinemaMemoryDesign.md)
- [Navigation and information architecture](Navigation.md)
- [TV Time Import Phase 1 acceptance (archived)](TvTimeImportPhase1Acceptance.md)
- [Export format](ExportFormat.md)

## Engineering & Architecture

- [System architecture](Architecture.md)
- [HTTP API](API.md)
- [Android client](Android.md)
- [Authentication](Authentication.md)
- [App Check](AppCheck.md)
- [Supabase migration and operations](supabase/README.md)
- [Supabase schema inventory](supabase/SchemaInventory.md)
- [Firestore schema reference (archived)](Firestore.md)

## Delivery & Quality

- [Deployment and release smoke](Deployment.md)
- [Coding standard](CodingStandard.md)
- [Dependency audit](DependencyAudit.md)
- [Supabase cutover runbook](supabase/Cutover.md)
- [Supabase definition of done](supabase/DefinitionOfDone.md)

## Implementation Records

- [Supabase Auth migration](supabase/AuthMigration.md)
- [Supabase retirement checklist](supabase/Phase10Retirement.md)
- [Android release checklist](Android.md#release-checklist)

## Archive

- [Resource alignment snapshot (archived)](ResourceAlignment.md)
- [TV Time Import acceptance ledger (archived)](TvTimeImportPhase1Acceptance.md)
- [Supabase Phases 4–6 implementation record (archived)](supabase/Phase4to6.md)
- [Supabase Phases 7–10 combined plan (archived)](supabase/Phase7to10.md)
- [Firestore schema and operating notes (archived)](Firestore.md)

## Lifecycle

1. Draft
2. Active
3. Deferred
4. Completed
5. Archived

Deferred specifications remain active. Completed or superseded documents add `(archived)` to their title and link to the current replacement. Archived files keep stable filenames so existing references continue to work.

## Synchronization Rules

- Product change: update the Notion Dashboard and relevant product definition.
- API or schema change: update code, tests, and the matching repository contract.
- Deployment or smoke result: update the Notion Engineering Release Log and Dashboard.
- New risk: update the Notion Technical Debt Register.
- Navigation change: update `Navigation.md`, route tests, and the Notion IA page.
- Data-plane change: update `Architecture.md`, `API.md`, `Deployment.md`, and `supabase/`.
