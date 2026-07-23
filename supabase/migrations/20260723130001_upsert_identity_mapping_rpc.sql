-- Service-role-only RPC so backfill scripts can upsert identity without exposing private schema.
create or replace function public.upsert_identity_mapping(
  p_firebase_uid text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if p_firebase_uid is null or length(trim(p_firebase_uid)) = 0 then
    raise exception 'firebase_uid required';
  end if;

  insert into private.identity_mappings (firebase_uid, email, updated_at)
  values (trim(p_firebase_uid), nullif(trim(coalesce(p_email, '')), ''), now())
  on conflict (firebase_uid) do update
    set email = coalesce(excluded.email, private.identity_mappings.email),
        updated_at = now();
end;
$$;

revoke all on function public.upsert_identity_mapping(text, text) from public;
grant execute on function public.upsert_identity_mapping(text, text) to service_role;

comment on function public.upsert_identity_mapping is
  'Upserts private.identity_mappings for Firestore→Supabase backfill. Callable only with service_role.';
