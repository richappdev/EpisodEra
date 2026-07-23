-- private schema, identity bridge, and helper functions
-- Model A: Express uses service_role; RLS remains defense-in-depth for JWT sessions.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

-- Firebase UIDs are opaque strings, not UUIDs. During the Auth bridge,
-- ownership columns use firebase_uid text. Native Supabase Auth (Phase 9)
-- fills supabase_user_id and remaps foreign keys later.
create table private.identity_mappings (
  id bigint generated always as identity primary key,
  supabase_user_id uuid unique,
  firebase_uid text not null unique,
  email text,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_mappings_firebase_uid_nonempty check (char_length(firebase_uid) > 0)
);

comment on table private.identity_mappings is
  'Maps Firebase Auth UID to future Supabase Auth UUID. Populated during Phase 9.';

create index identity_mappings_email_idx on private.identity_mappings (email);

-- JWT subject for Firebase third-party Auth (string UID). Prefer this over auth.uid()
-- until native Supabase Auth cutover proves uuid semantics.
create or replace function private.request_firebase_uid()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'sub', nullif(auth.uid()::text, ''));
$$;

revoke all on function private.request_firebase_uid() from public;
grant execute on function private.request_firebase_uid() to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
