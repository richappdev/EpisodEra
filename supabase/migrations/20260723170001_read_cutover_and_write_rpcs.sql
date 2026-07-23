-- Friendship directional statuses + derived-cache read + public progress write RPC.

alter table public.friendships
  drop constraint if exists friendships_status_check;

alter table public.friendships
  add constraint friendships_status_check
  check (status in (
    'pending',
    'pending_outgoing',
    'pending_incoming',
    'accepted',
    'blocked'
  ));

create or replace function public.get_derived_cache(
  p_firebase_uid text,
  p_cache_key text
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_row private.derived_cache%rowtype;
begin
  select * into v_row
  from private.derived_cache
  where firebase_uid = trim(p_firebase_uid)
    and cache_key = trim(p_cache_key);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'payload', v_row.payload,
    'computed_at', v_row.computed_at,
    'invalidated_at', v_row.invalidated_at
  );
end;
$$;

revoke all on function public.get_derived_cache(text, text) from public;
grant execute on function public.get_derived_cache(text, text) to service_role;

create or replace function public.mark_episodes_watched(
  p_firebase_uid text,
  p_show_tmdb_id integer,
  p_title text,
  p_poster_path text,
  p_total_episodes integer,
  p_episodes jsonb,
  p_genre_names text[] default '{}',
  p_preserve_earliest_watched_at boolean default false
)
returns public.show_progress
language plpgsql
security definer
set search_path = public, private
as $$
begin
  return private.mark_episodes_watched(
    p_firebase_uid,
    p_show_tmdb_id,
    p_title,
    p_poster_path,
    p_total_episodes,
    p_episodes,
    p_genre_names,
    p_preserve_earliest_watched_at
  );
end;
$$;

revoke all on function public.mark_episodes_watched(text, integer, text, text, integer, jsonb, text[], boolean) from public;
grant execute on function public.mark_episodes_watched(text, integer, text, text, integer, jsonb, text[], boolean) to service_role;
