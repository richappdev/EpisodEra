-- Dual-write / delta-sync outbox. Never silently drop secondary failures.

create table private.migration_sync_failures (
  operation_id text primary key,
  firebase_uid text,
  domain text not null,
  operation text not null,
  payload jsonb not null default '{}'::jsonb,
  error text not null,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  last_attempt_at timestamptz not null default now()
);

create index migration_sync_failures_open_idx
  on private.migration_sync_failures (domain, created_at)
  where resolved_at is null;

create table private.migration_parity_reports (
  id bigint generated always as identity primary key,
  domain text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

revoke all on table private.migration_sync_failures from anon, authenticated;
revoke all on table private.migration_parity_reports from anon, authenticated;
grant select, insert, update, delete on table private.migration_sync_failures to service_role;
grant select, insert, update, delete on table private.migration_parity_reports to service_role;

alter table private.migration_sync_failures enable row level security;
alter table private.migration_parity_reports enable row level security;
