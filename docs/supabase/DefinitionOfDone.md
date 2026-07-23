# Supabase domain definition of done

A migrated domain is complete only when:

- [ ] Schema exists as reviewed SQL migrations under `supabase/migrations/`
- [ ] Local `supabase db reset` succeeds
- [ ] SQL tests under `supabase/tests/` pass
- [ ] Security advisor: no unresolved criticals
- [ ] Performance advisor findings reviewed
- [ ] RLS enabled on exposed tables; mutable tables not granted to `anon`
- [ ] Cross-user access tests pass
- [ ] Firebase-authenticated access works during transition (bridge proof)
- [ ] API responses match the Firebase implementation
- [ ] Historical data counts match; delta writes reconcile; re-runs idempotent
- [ ] Rollback tested
- [ ] Generated TypeScript types current (when enabled)
- [ ] No service-role key in browser/Android clients
- [ ] Production DDL requires manual approval
