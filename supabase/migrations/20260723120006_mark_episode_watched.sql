-- Backend-managed progress transaction (SECURITY INVOKER; called only via service_role).
-- Mirrors functions/src/services/progressService.ts updateEpisodes transactional core.
-- Watchlist status sync and derived-cache invalidation remain in Express (outside this txn),
-- matching current Firestore behaviour.

create or replace function private.episode_key(p_season integer, p_episode integer)
returns text
language sql
immutable
as $$
  select 's' || lpad(p_season::text, 2, '0') || 'e' || lpad(p_episode::text, 2, '0');
$$;

create or replace function private.mark_episodes_watched(
  p_firebase_uid text,
  p_show_tmdb_id integer,
  p_title text,
  p_poster_path text,
  p_total_episodes integer,
  p_episodes jsonb,
  -- [{season_number, episode_number, episode_title, watched, watched_at?, source?, source_import_id?}]
  p_genre_names text[] default '{}',
  p_preserve_earliest_watched_at boolean default false
)
returns public.show_progress
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_progress public.show_progress%rowtype;
  v_ep jsonb;
  v_season integer;
  v_episode integer;
  v_title text;
  v_key text;
  v_watched boolean;
  v_watched_at timestamptz;
  v_source text;
  v_import_id text;
  v_existing_at timestamptz;
  v_was_watched boolean;
  v_keys text[];
  v_count integer;
  v_history_key text;
begin
  if p_firebase_uid is null or p_firebase_uid = '' then
    raise exception 'firebase_uid required';
  end if;

  insert into public.show_progress as sp (
    firebase_uid, show_tmdb_id, title, poster_path, total_episodes, updated_at
  ) values (
    p_firebase_uid, p_show_tmdb_id, p_title, p_poster_path, greatest(p_total_episodes, 0), now()
  )
  on conflict (firebase_uid, show_tmdb_id) do update
    set title = excluded.title,
        poster_path = coalesce(sp.poster_path, excluded.poster_path),
        total_episodes = greatest(excluded.total_episodes, sp.total_episodes),
        updated_at = now();

  for v_ep in select * from jsonb_array_elements(coalesce(p_episodes, '[]'::jsonb))
  loop
    v_season := (v_ep->>'season_number')::integer;
    v_episode := (v_ep->>'episode_number')::integer;
    v_title := v_ep->>'episode_title';
    v_watched := coalesce((v_ep->>'watched')::boolean, true);
    v_key := private.episode_key(v_season, v_episode);
    v_source := nullif(v_ep->>'source', '');
    v_import_id := nullif(v_ep->>'source_import_id', '');
    v_watched_at := coalesce((v_ep->>'watched_at')::timestamptz, now());
    v_history_key := 'tv_' || p_show_tmdb_id || '_' || v_key;

    if v_watched then
      select watched_at into v_existing_at
      from public.watched_episodes
      where firebase_uid = p_firebase_uid
        and show_tmdb_id = p_show_tmdb_id
        and season_number = v_season
        and episode_number = v_episode;

      v_was_watched := found;

      if p_preserve_earliest_watched_at and v_was_watched then
        v_watched_at := least(v_existing_at, v_watched_at);
      elsif v_was_watched and not p_preserve_earliest_watched_at then
        v_watched_at := v_existing_at;
      end if;

      insert into public.watched_episodes (
        firebase_uid, show_tmdb_id, season_number, episode_number, episode_key,
        episode_title, watched_at, updated_at, source, source_import_id
      ) values (
        p_firebase_uid, p_show_tmdb_id, v_season, v_episode, v_key,
        v_title, v_watched_at, now(), v_source, v_import_id
      )
      on conflict (firebase_uid, show_tmdb_id, season_number, episode_number) do update
        set episode_title = excluded.episode_title,
            watched_at = case
              when p_preserve_earliest_watched_at
                then least(public.watched_episodes.watched_at, excluded.watched_at)
              else public.watched_episodes.watched_at
            end,
            updated_at = now(),
            source = coalesce(public.watched_episodes.source, excluded.source),
            source_import_id = coalesce(public.watched_episodes.source_import_id, excluded.source_import_id);

      insert into public.watch_history (
        firebase_uid, history_key, tmdb_id, media_type, title,
        season_number, episode_number, episode_title, watched_at, updated_at,
        rewatch_count, genre_names
      ) values (
        p_firebase_uid, v_history_key, p_show_tmdb_id, 'tv', p_title,
        v_season, v_episode, v_title, v_watched_at, now(),
        0, coalesce(p_genre_names, '{}')
      )
      on conflict (firebase_uid, history_key) do update
        set title = excluded.title,
            episode_title = excluded.episode_title,
            updated_at = now(),
            rewatch_count = case
              when v_was_watched and not p_preserve_earliest_watched_at
                then public.watch_history.rewatch_count + 1
              else public.watch_history.rewatch_count
            end,
            genre_names = excluded.genre_names,
            watched_at = case
              when p_preserve_earliest_watched_at
                then least(public.watch_history.watched_at, excluded.watched_at)
              else public.watch_history.watched_at
            end;
    else
      delete from public.watched_episodes
      where firebase_uid = p_firebase_uid
        and show_tmdb_id = p_show_tmdb_id
        and season_number = v_season
        and episode_number = v_episode;

      delete from public.watch_history
      where firebase_uid = p_firebase_uid
        and history_key = v_history_key;
    end if;
  end loop;

  select array_agg(episode_key order by episode_key)
  into v_keys
  from public.watched_episodes
  where firebase_uid = p_firebase_uid and show_tmdb_id = p_show_tmdb_id;

  v_keys := coalesce(v_keys, '{}');
  v_count := coalesce(cardinality(v_keys), 0);

  -- Persist aggregate; next_* filled by Express when canonical season list is known,
  -- or left null for a follow-up update. Count/keys/percent are authoritative here.
  update public.show_progress
  set watched_episode_keys = v_keys,
      watched_episode_count = v_count,
      progress_percent = case
        when p_total_episodes > 0 then round((v_count::numeric / p_total_episodes::numeric) * 100, 2)
        else 0
      end,
      current_season = (
        select season_number from public.watched_episodes
        where firebase_uid = p_firebase_uid and show_tmdb_id = p_show_tmdb_id
        order by season_number desc, episode_number desc limit 1
      ),
      current_episode = (
        select episode_number from public.watched_episodes
        where firebase_uid = p_firebase_uid and show_tmdb_id = p_show_tmdb_id
        order by season_number desc, episode_number desc limit 1
      ),
      updated_at = now()
  where firebase_uid = p_firebase_uid and show_tmdb_id = p_show_tmdb_id
  returning * into v_progress;

  return v_progress;
end;
$$;

revoke all on function private.mark_episodes_watched(text, integer, text, text, integer, jsonb, text[], boolean) from public;
grant execute on function private.mark_episodes_watched(text, integer, text, text, integer, jsonb, text[], boolean) to service_role;

comment on function private.mark_episodes_watched is
  'Atomic episode + history + progress aggregate write. Call only from Express (service_role). Next-episode resolution and watchlist sync stay in application code.';
