-- Friends, imports, discussions, puzzles / game stats

create table public.friendships (
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  friend_firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  friend_code text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firebase_uid, friend_firebase_uid),
  constraint friendships_no_self check (firebase_uid <> friend_firebase_uid)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  provider text not null default 'tv_time',
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.import_staged_shows (
  import_id uuid not null references public.imports (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (import_id, media_type, tmdb_id)
);

create table private.import_staged_episodes (
  import_id uuid not null references public.imports (id) on delete cascade,
  show_tmdb_id integer not null,
  season_number integer not null,
  episode_number integer not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (import_id, show_tmdb_id, season_number, episode_number)
);

create table public.discussion_comments (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  author_firebase_uid text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index discussion_comments_media_idx
  on public.discussion_comments (media_type, tmdb_id, created_at desc);

create table public.puzzles_public (
  puzzle_id text primary key,
  puzzle_date date not null unique,
  payload jsonb not null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table private.puzzles_private (
  puzzle_id text primary key references public.puzzles_public (puzzle_id) on delete cascade,
  answer jsonb not null,
  hints jsonb not null default '[]'::jsonb,
  status text not null,
  image_asset jsonb,
  updated_at timestamptz not null default now()
);

create table public.puzzle_attempts (
  player_id text not null,
  puzzle_id text not null references public.puzzles_public (puzzle_id) on delete cascade,
  attempt_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, puzzle_id)
);

create table public.user_game_stats (
  firebase_uid text primary key,
  current_streak integer not null default 0,
  max_streak integer not null default 0,
  wins integer not null default 0,
  plays integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table private.game_config (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

insert into private.game_config (key, payload)
values ('dailyPuzzle', '{}'::jsonb)
on conflict (key) do nothing;

revoke all on table public.friendships from anon, authenticated;
revoke all on table public.imports from anon, authenticated;
revoke all on table private.import_staged_shows from anon, authenticated;
revoke all on table private.import_staged_episodes from anon, authenticated;
revoke all on table public.discussion_comments from anon, authenticated;
revoke all on table public.puzzles_public from anon, authenticated;
revoke all on table private.puzzles_private from anon, authenticated;
revoke all on table public.puzzle_attempts from anon, authenticated;
revoke all on table public.user_game_stats from anon, authenticated;
revoke all on table private.game_config from anon, authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema private to service_role;

alter table public.friendships enable row level security;
alter table public.imports enable row level security;
alter table private.import_staged_shows enable row level security;
alter table private.import_staged_episodes enable row level security;
alter table public.discussion_comments enable row level security;
alter table public.puzzles_public enable row level security;
alter table private.puzzles_private enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.user_game_stats enable row level security;
alter table private.game_config enable row level security;
