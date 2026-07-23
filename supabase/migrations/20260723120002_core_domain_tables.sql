-- Core profile / settings / catalog tables (firebase_uid ownership during bridge)

create table public.profiles (
  firebase_uid text primary key,
  first_name text not null,
  last_name text not null,
  display_name text,
  email text not null,
  photo_url text,
  bio text,
  country char(2),
  timezone text,
  friend_code char(6) unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_friend_code_format check (
    friend_code is null or friend_code ~ '^[A-Z0-9]{6}$'
  )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create table public.user_settings (
  firebase_uid text primary key references public.profiles (firebase_uid) on delete cascade,
  locale text,
  theme text,
  spoiler_mode text,
  notification_prefs jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

-- Rules-ready in Firestore but not productized; table reserved, not dual-written yet.
create table public.ratings (
  firebase_uid text not null references public.profiles (firebase_uid) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5.0),
  updated_at timestamptz not null default now(),
  primary key (firebase_uid, media_type, tmdb_id)
);

create table public.franchises (
  slug text primary key,
  title text not null,
  description text,
  published boolean not null default false,
  sort_order integer not null default 0,
  phases jsonb not null default '[]'::jsonb,
  titles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.media_mappings (
  provider text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  external_id text not null,
  tmdb_id integer not null check (tmdb_id > 0),
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, media_type, external_id)
);

-- Model A: no browser Data API exposure for mutable user tables.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
revoke all on table public.ratings from anon, authenticated;
revoke all on table public.franchises from anon, authenticated;
revoke all on table public.media_mappings from anon, authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.user_settings to service_role;
grant select, insert, update, delete on table public.ratings to service_role;
grant select, insert, update, delete on table public.franchises to service_role;
grant select, insert, update, delete on table public.media_mappings to service_role;

-- Read-only franchise catalog may later move to authenticated SELECT (Model B).
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.ratings enable row level security;
alter table public.franchises enable row level security;
alter table public.media_mappings enable row level security;
