# Phase 10 — Retirement checklist

> **Status:** Active
> **Authority:** Remaining Firebase data/runtime retirement and retention checklist
> **Owner role:** Engineering and release operations
> **Last reviewed:** 2026-07-27
> **Current baseline:** See the Notion MVP Dashboard
> **Notion counterpart:** [Supabase Post-Cutover Validation Record](https://app.notion.com/p/3aaa4181b628811e9621fc27c2a0df2a)
> **Supersedes:** Retirement steps embedded in the archived combined phase plan

Production data-plane flags are already enabled. This checklist now governs validation, retention, Auth migration, dependency removal, and final Firebase service retirement.

## Current production data flags

```env
FIRESTORE_WRITES_DISABLED=true
# Domain-specific SUPABASE_READ_* flags are enabled in production.
# SUPABASE_READ_PRIMARY=true remains an optional aggregate switch.
```

Helpers exist in `functions/src/config/env.ts` (`isFirestoreWritesDisabled`, `isSupabaseReadPrimary`). Product writers honor the Firestore persistence gate; continue validating parity, outbox state, and rollback behavior.

## Order

1. Record current-tip hosted smoke and post-cutover soak evidence.
2. Keep `private.migration_sync_failures` drained and validate domain parity.
3. Test rollback: catch up Firestore, re-enable the mirror, and verify API behavior.
4. Define and complete the Firebase read-only retention window.
5. Decide and execute Phase 9 Auth migration, if approved.
6. Remove remaining Functions Firestore dependencies after the retention window.
7. Retire Firebase Auth/runtime services only after explicit approval; Hosting and Analytics may lag.

This repo never auto-deletes Firebase projects.
