-- Defense-in-depth RLS for Firebase JWT bridge (auth.jwt()->>'sub' = firebase_uid).
-- Model A: Express uses service_role (bypasses RLS). Policies prepare Model B / JWT tests.

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select private.request_firebase_uid()) = firebase_uid);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "settings_select_own"
on public.user_settings for select to authenticated
using ((select private.request_firebase_uid()) = firebase_uid);

create policy "settings_upsert_own"
on public.user_settings for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "watchlist_select_own"
on public.watchlist_items for select to authenticated
using ((select private.request_firebase_uid()) = firebase_uid);

create policy "watchlist_insert_own"
on public.watchlist_items for insert to authenticated
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "watchlist_update_own"
on public.watchlist_items for update to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "watchlist_delete_own"
on public.watchlist_items for delete to authenticated
using ((select private.request_firebase_uid()) = firebase_uid);

create policy "likes_own_all"
on public.likes for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "progress_own_all"
on public.show_progress for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "watched_episodes_own_all"
on public.watched_episodes for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "history_own_all"
on public.watch_history for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "friendships_own_all"
on public.friendships for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "imports_select_own"
on public.imports for select to authenticated
using ((select private.request_firebase_uid()) = firebase_uid);

create policy "game_stats_own_all"
on public.user_game_stats for all to authenticated
using ((select private.request_firebase_uid()) = firebase_uid)
with check ((select private.request_firebase_uid()) = firebase_uid);

create policy "puzzle_attempts_own_all"
on public.puzzle_attempts for all to authenticated
using ((select private.request_firebase_uid()) = player_id)
with check ((select private.request_firebase_uid()) = player_id);

-- Public puzzle payloads may be readable once Model B grants SELECT to authenticated/anon.
create policy "puzzles_public_read"
on public.puzzles_public for select to authenticated
using (published_at is not null);

-- No policies on private.* for authenticated — service_role only.
