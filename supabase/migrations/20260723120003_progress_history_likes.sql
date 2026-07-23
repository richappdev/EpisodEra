-- Watchlist, likes, show progress, watched episodes, history

create extension if not exists "pgcrypto";

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  backdrop_path text,
  status text not null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firebase_uid, media_type, tmdb_id),
  constraint watchlist_status_valid check (
    (media_type = 'tv' and status in ('planned', 'watching', 'completed', 'dropped'))
    or (media_type = 'movie' and status in ('unwatched', 'watched'))
  )
);

create index watchlist_items_uid_updated_idx
  on public.watchlist_items (firebase_uid, updated_at desc);

create table public.likes (
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  title text,
  poster_path text,
  liked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firebase_uid, media_type, tmdb_id)
);

create table public.show_progress (
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  show_tmdb_id integer not null check (show_tmdb_id > 0),
  title text not null,
  poster_path text,
  total_episodes integer not null default 0 check (total_episodes >= 0),
  watched_episode_count integer not null default 0 check (watched_episode_count >= 0),
  progress_percent numeric(5,2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  current_season integer,
  current_episode integer,
  next_season_number integer,
  next_episode_number integer,
  next_episode_title text,
  -- Denormalized keys matching Firestore watchedEpisodeKeys (episodeKey like s01e01).
  watched_episode_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (firebase_uid, show_tmdb_id),
  constraint show_progress_keys_limit check (cardinality(watched_episode_keys) <= 2000)
);

create table public.watched_episodes (
  firebase_uid text not null,
  show_tmdb_id integer not null,
  season_number integer not null check (season_number >= 0),
  episode_number integer not null check (episode_number >= 1),
  episode_key text not null,
  episode_title text,
  watched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text check (source is null or source in ('tv_time', 'manual', 'bulk_season', 'bulk_fill_previous')),
  source_import_id text,
  primary key (firebase_uid, show_tmdb_id, season_number, episode_number),
  foreign key (firebase_uid, show_tmdb_id)
    references public.show_progress (firebase_uid, show_tmdb_id)
    on delete cascade
);

create unique index watched_episodes_key_uidx
  on public.watched_episodes (firebase_uid, show_tmdb_id, episode_key);

create table public.watch_history (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  -- Deterministic Firestore-style id: movie_N | tv_N_sNNeNN
  history_key text not null,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  season_number integer,
  episode_number integer,
  episode_title text,
  watched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rewatch_count integer not null default 0 check (rewatch_count >= 0),
  genre_names text[] not null default '{}',
  runtime_minutes integer,
  unique (firebase_uid, history_key)
);

create index watch_history_uid_watched_idx
  on public.watch_history (firebase_uid, watched_at desc);

-- Derived TTL cache (port Firestore users/{uid}/derived/* semantics).
create table private.derived_cache (
  firebase_uid text not null,
  cache_key text not null,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  invalidated_at timestamptz,
  primary key (firebase_uid, cache_key)
);

revoke all on table public.watchlist_items from anon, authenticated;
revoke all on table public.likes from anon, authenticated;
revoke all on table public.show_progress from anon, authenticated;
revoke all on table public.watched_episodes from anon, authenticated;
revoke all on table public.watch_history from anon, authenticated;
revoke all on table private.derived_cache from anon, authenticated;

grant select, insert, update, delete on table public.watchlist_items to service_role;
grant select, insert, update, delete on table public.likes to service_role;
grant select, insert, update, delete on table public.show_progress to service_role;
grant select, insert, update, delete on table public.watched_episodes to service_role;
grant select, insert, update, delete on table public.watch_history to service_role;
grant select, insert, update, delete on table private.derived_cache to service_role;

alter table public.watchlist_items enable row level security;
alter table public.likes enable row level security;
alter table public.show_progress enable row level security;
alter table public.watched_episodes enable row level security;
alter table public.watch_history enable row level security;
alter table private.derived_cache enable row level security;
