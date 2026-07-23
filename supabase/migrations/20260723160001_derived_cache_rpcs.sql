-- Phase 8: derived cache shadow helpers (private.derived_cache).

create or replace function public.upsert_derived_cache(
  p_firebase_uid text,
  p_cache_key text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.derived_cache as d (
    firebase_uid, cache_key, payload, computed_at, invalidated_at
  ) values (
    trim(p_firebase_uid), trim(p_cache_key), coalesce(p_payload, '{}'::jsonb), now(), null
  )
  on conflict (firebase_uid, cache_key) do update
    set payload = excluded.payload,
        computed_at = now(),
        invalidated_at = null;
end;
$$;

create or replace function public.invalidate_derived_cache(p_firebase_uid text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  update private.derived_cache
  set invalidated_at = now()
  where firebase_uid = trim(p_firebase_uid);
end;
$$;

revoke all on function public.upsert_derived_cache(text, text, jsonb) from public;
revoke all on function public.invalidate_derived_cache(text) from public;
grant execute on function public.upsert_derived_cache(text, text, jsonb) to service_role;
grant execute on function public.invalidate_derived_cache(text) to service_role;
