-- Record dual-write / delta-sync failures without exposing private schema via Data API.
create or replace function public.record_migration_sync_failure(
  p_operation_id text,
  p_firebase_uid text default null,
  p_domain text default 'unknown',
  p_operation text default 'unknown',
  p_payload jsonb default '{}'::jsonb,
  p_error text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if p_operation_id is null or length(trim(p_operation_id)) = 0 then
    raise exception 'operation_id required';
  end if;

  insert into private.migration_sync_failures as f (
    operation_id,
    firebase_uid,
    domain,
    operation,
    payload,
    error,
    attempt_count,
    created_at,
    last_attempt_at
  ) values (
    trim(p_operation_id),
    nullif(trim(coalesce(p_firebase_uid, '')), ''),
    coalesce(nullif(trim(p_domain), ''), 'unknown'),
    coalesce(nullif(trim(p_operation), ''), 'unknown'),
    coalesce(p_payload, '{}'::jsonb),
    left(coalesce(p_error, 'unknown'), 4000),
    1,
    now(),
    now()
  )
  on conflict (operation_id) do update
    set error = excluded.error,
        payload = excluded.payload,
        attempt_count = f.attempt_count + 1,
        last_attempt_at = now(),
        resolved_at = null;
end;
$$;

revoke all on function public.record_migration_sync_failure(text, text, text, text, jsonb, text) from public;
grant execute on function public.record_migration_sync_failure(text, text, text, text, jsonb, text) to service_role;

comment on function public.record_migration_sync_failure is
  'Phase 6 shadow dual-write outbox. Service-role only.';
