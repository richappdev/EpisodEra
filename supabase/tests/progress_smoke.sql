-- Basic SQL tests for local supabase db test / pgTAP-style runners.
-- Run after migrations: identity helper and progress transaction smoke.

begin;

select private.episode_key(1, 2) = 's01e02' as episode_key_ok;

insert into public.profiles (firebase_uid, first_name, last_name, email)
values ('firebase-test-uid', 'Test', 'User', 'test@example.com');

select private.mark_episodes_watched(
  'firebase-test-uid',
  95396,
  'Severance',
  null,
  10,
  '[{"season_number":1,"episode_number":1,"episode_title":"Good News About Hell","watched":true}]'::jsonb,
  array['Drama']::text[],
  false
);

select watched_episode_count = 1 as progress_count_ok
from public.show_progress
where firebase_uid = 'firebase-test-uid' and show_tmdb_id = 95396;

select count(*) = 1 as history_ok
from public.watch_history
where firebase_uid = 'firebase-test-uid';

rollback;
