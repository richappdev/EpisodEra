-- Remaining Firestore domains: discussion columns + private-schema write RPCs

alter table public.discussion_comments
  add column if not exists display_name text,
  add column if not exists season_number integer,
  add column if not exists episode_number integer,
  add column if not exists firestore_id text;

create unique index if not exists discussion_comments_firestore_id_uidx
  on public.discussion_comments (firestore_id);

-- Puzzles (private answers stay in private schema)
create or replace function public.upsert_puzzle_private(
  p_puzzle_id text,
  p_answer jsonb,
  p_hints jsonb,
  p_status text,
  p_image_asset jsonb default null
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.puzzles_private as p (
    puzzle_id, answer, hints, status, image_asset, updated_at
  ) values (
    p_puzzle_id, coalesce(p_answer, '{}'::jsonb), coalesce(p_hints, '[]'::jsonb),
    p_status, p_image_asset, now()
  )
  on conflict (puzzle_id) do update
  set answer = excluded.answer,
      hints = excluded.hints,
      status = excluded.status,
      image_asset = excluded.image_asset,
      updated_at = now();
end;
$$;

create or replace function public.get_puzzle_private(p_puzzle_id text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_row private.puzzles_private%rowtype;
begin
  select * into v_row from private.puzzles_private where puzzle_id = p_puzzle_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'puzzle_id', v_row.puzzle_id,
    'answer', v_row.answer,
    'hints', v_row.hints,
    'status', v_row.status,
    'image_asset', v_row.image_asset,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.list_scheduled_puzzle_ids(p_today date)
returns text[]
language plpgsql
security definer
set search_path = private, public
as $$
begin
  return coalesce(
    array(
      select puzzle_id
      from private.puzzles_private
      where status = 'scheduled'
        and puzzle_id <= to_char(p_today, 'YYYY-MM-DD')
      order by puzzle_id
    ),
    '{}'::text[]
  );
end;
$$;

create or replace function public.upsert_game_config(p_key text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.game_config as g (key, payload, updated_at)
  values (p_key, coalesce(p_payload, '{}'::jsonb), now())
  on conflict (key) do update
  set payload = excluded.payload,
      updated_at = now();
end;
$$;

create or replace function public.get_game_config(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_payload jsonb;
begin
  select payload into v_payload from private.game_config where key = p_key;
  return v_payload;
end;
$$;

-- Import staging
create or replace function public.upsert_import_staged_show(
  p_import_id uuid,
  p_media_type text,
  p_tmdb_id integer,
  p_status text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.import_staged_shows as s (
    import_id, media_type, tmdb_id, status, payload
  ) values (
    p_import_id, p_media_type, p_tmdb_id, coalesce(p_status, 'pending'), coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (import_id, media_type, tmdb_id) do update
  set status = excluded.status,
      payload = excluded.payload;
end;
$$;

create or replace function public.upsert_import_staged_episode(
  p_import_id uuid,
  p_show_tmdb_id integer,
  p_season_number integer,
  p_episode_number integer,
  p_status text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  insert into private.import_staged_episodes as e (
    import_id, show_tmdb_id, season_number, episode_number, status, payload
  ) values (
    p_import_id, p_show_tmdb_id, p_season_number, p_episode_number,
    coalesce(p_status, 'pending'), coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (import_id, show_tmdb_id, season_number, episode_number) do update
  set status = excluded.status,
      payload = excluded.payload;
end;
$$;

create or replace function public.delete_import_staged(p_import_id uuid)
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_count integer := 0;
begin
  with d as (
    delete from private.import_staged_shows where import_id = p_import_id returning 1
  )
  select count(*) into v_count from d;
  delete from private.import_staged_episodes where import_id = p_import_id;
  return v_count;
end;
$$;

create or replace function public.list_import_staged_shows(p_import_id uuid, p_imported_only boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'media_type', media_type,
        'tmdb_id', tmdb_id,
        'status', status,
        'payload', payload
      ))
      from private.import_staged_shows
      where import_id = p_import_id
        and (
          p_imported_only is null
          or (p_imported_only = false and coalesce(payload->>'imported', 'false') = 'false')
          or (p_imported_only = true and coalesce(payload->>'imported', 'false') = 'true')
        )
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.list_import_staged_episodes(p_import_id uuid, p_status text default null, p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
begin
  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'show_tmdb_id', show_tmdb_id,
        'season_number', season_number,
        'episode_number', episode_number,
        'status', status,
        'payload', payload
      ))
      from (
        select *
        from private.import_staged_episodes
        where import_id = p_import_id
          and (p_status is null or status = p_status)
        order by show_tmdb_id, season_number, episode_number
        limit greatest(p_limit, 1)
      ) q
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.upsert_puzzle_private(text, jsonb, jsonb, text, jsonb) from public;
revoke all on function public.get_puzzle_private(text) from public;
revoke all on function public.list_scheduled_puzzle_ids(date) from public;
revoke all on function public.upsert_game_config(text, jsonb) from public;
revoke all on function public.get_game_config(text) from public;
revoke all on function public.upsert_import_staged_show(uuid, text, integer, text, jsonb) from public;
revoke all on function public.upsert_import_staged_episode(uuid, integer, integer, integer, text, jsonb) from public;
revoke all on function public.delete_import_staged(uuid) from public;
revoke all on function public.list_import_staged_shows(uuid, boolean) from public;
revoke all on function public.list_import_staged_episodes(uuid, text, integer) from public;

grant execute on function public.upsert_puzzle_private(text, jsonb, jsonb, text, jsonb) to service_role;
grant execute on function public.get_puzzle_private(text) to service_role;
grant execute on function public.list_scheduled_puzzle_ids(date) to service_role;
grant execute on function public.upsert_game_config(text, jsonb) to service_role;
grant execute on function public.get_game_config(text) to service_role;
grant execute on function public.upsert_import_staged_show(uuid, text, integer, text, jsonb) to service_role;
grant execute on function public.upsert_import_staged_episode(uuid, integer, integer, integer, text, jsonb) to service_role;
grant execute on function public.delete_import_staged(uuid) to service_role;
grant execute on function public.list_import_staged_shows(uuid, boolean) to service_role;
grant execute on function public.list_import_staged_episodes(uuid, text, integer) to service_role;
