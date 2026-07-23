-- Probe used by scripts/supabase/prove-firebase-jwt.mjs for Auth bridge proof.
create or replace function public.firebase_uid_probe()
returns text
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.request_firebase_uid();
$$;

revoke all on function public.firebase_uid_probe() from public;
grant execute on function public.firebase_uid_probe() to anon, authenticated, service_role;

comment on function public.firebase_uid_probe is
  'Returns JWT sub / Firebase UID for third-party Auth bridge verification.';
