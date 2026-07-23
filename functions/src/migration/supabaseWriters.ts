import {getSupabaseEnvOrNull, supabaseRest, supabaseRpc} from "../db/supabaseClient";
import {UserProfile} from "../models/profile";
import {UserSettings} from "../models/settings";
import {WatchlistItem} from "../models/watchlist";
import {LikedItem} from "../models/likes";
import {ShowProgress} from "../models/progress";
import {HistoryEntry} from "../models/history";

const upsert = async (table: string, onConflict: string, rows: unknown[]) => {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRest(env, `${table}?on_conflict=${onConflict}`, {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
};

const removeEq = async (table: string, filters: string) => {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRest(env, `${table}?${filters}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
};

export async function upsertIdentityMapping(firebaseUid: string, email: string | null): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRpc(env, "upsert_identity_mapping", {
    p_firebase_uid: firebaseUid,
    p_email: email,
  });
}

/**
 * Insert a minimal profiles row if missing. Uses ignore-duplicates so existing
 * profiles are never overwritten (progress/history FKs require a parent row).
 */
export async function ensureProfileStubShadow(
  firebaseUid: string,
  email: string | null = null,
): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  const now = new Date().toISOString();
  await supabaseRest(env, "profiles?on_conflict=firebase_uid", {
    method: "POST",
    body: [
      {
        firebase_uid: firebaseUid,
        first_name: "User",
        last_name: "Unknown",
        display_name: null,
        email: email || `${firebaseUid}@users.firebase.local`,
        photo_url: null,
        bio: null,
        country: null,
        timezone: null,
        friend_code: null,
        created_at: now,
        updated_at: now,
      },
    ],
    prefer: "resolution=ignore-duplicates,return=minimal",
  });
  await upsertIdentityMapping(firebaseUid, email);
}

export async function upsertProfileShadow(firebaseUid: string, profile: UserProfile): Promise<void> {
  await upsert("profiles", "firebase_uid", [
    {
      firebase_uid: firebaseUid,
      first_name: profile.firstName || "User",
      last_name: profile.lastName || "Unknown",
      display_name: profile.displayName,
      email: profile.email || `${firebaseUid}@users.firebase.local`,
      photo_url: profile.photoURL,
      bio: profile.bio,
      country:
        typeof profile.country === "string" && /^[A-Za-z]{2}$/.test(profile.country)
          ? profile.country.toUpperCase()
          : null,
      timezone: profile.timezone,
      friend_code:
        typeof profile.friendCode === "string" && /^[A-Z0-9]{6}$/i.test(profile.friendCode)
          ? profile.friendCode.toUpperCase()
          : null,
      created_at: profile.createdAt ?? new Date().toISOString(),
      updated_at: profile.updatedAt ?? new Date().toISOString(),
    },
  ]);
  await upsertIdentityMapping(firebaseUid, profile.email);
}

export async function upsertSettingsShadow(firebaseUid: string, settings: UserSettings): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await upsert("user_settings", "firebase_uid", [
    {
      firebase_uid: firebaseUid,
      locale: settings.language,
      theme: null,
      spoiler_mode: settings.hideSpoilersUntilWatched ? "until_watched" : "off",
      notification_prefs: {},
      raw: {
        autoMarkPreviousEpisodesWatched: settings.autoMarkPreviousEpisodesWatched,
        language: settings.language,
        preferredProviderIds: settings.preferredProviderIds,
        watchRegion: settings.watchRegion,
        achievementsEnabled: settings.achievementsEnabled,
        showAchievementsOnProfile: settings.showAchievementsOnProfile,
        shareActivityWithFriends: settings.shareActivityWithFriends,
        allowFriendRequests: settings.allowFriendRequests,
        hideSpoilersUntilWatched: settings.hideSpoilersUntilWatched,
      },
      updated_at: settings.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

export async function upsertWatchlistShadow(firebaseUid: string, item: WatchlistItem): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await upsert("watchlist_items", "firebase_uid,media_type,tmdb_id", [
    {
      firebase_uid: firebaseUid,
      tmdb_id: item.tmdbId,
      media_type: item.mediaType,
      title: item.title,
      poster_path: item.poster,
      backdrop_path: item.backdrop,
      status: item.status,
      added_at: item.addedAt ?? new Date().toISOString(),
      updated_at: item.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

export async function removeWatchlistShadow(
  firebaseUid: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<void> {
  await removeEq(
    "watchlist_items",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&media_type=eq.${mediaType}&tmdb_id=eq.${tmdbId}`,
  );
}

export async function upsertLikeShadow(firebaseUid: string, item: LikedItem): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await upsert("likes", "firebase_uid,media_type,tmdb_id", [
    {
      firebase_uid: firebaseUid,
      media_type: item.mediaType,
      tmdb_id: item.tmdbId,
      title: item.title,
      poster_path: item.poster,
      liked_at: item.likedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
}

export async function removeLikeShadow(
  firebaseUid: string,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<void> {
  await removeEq(
    "likes",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&media_type=eq.${mediaType}&tmdb_id=eq.${tmdbId}`,
  );
}

export async function upsertShowProgressShadow(
  firebaseUid: string,
  progress: ShowProgress,
): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  const next = progress.nextEpisode;
  const watchedKeys = progress.episodes
    .filter((episode) => episode.watched)
    .map((episode) => episode.episodeKey);

  await upsert("show_progress", "firebase_uid,show_tmdb_id", [
    {
      firebase_uid: firebaseUid,
      show_tmdb_id: progress.tmdbId,
      title: progress.title,
      poster_path: progress.poster,
      total_episodes: progress.totalEpisodes,
      watched_episode_count: progress.watchedEpisodeCount,
      progress_percent: progress.progressPercent,
      current_season: progress.currentSeason,
      current_episode: progress.currentEpisode,
      next_season_number: next?.seasonNumber ?? null,
      next_episode_number: next?.episodeNumber ?? null,
      next_episode_title: next?.episodeTitle ?? null,
      watched_episode_keys: watchedKeys.slice(0, 2000),
      updated_at: progress.updatedAt ?? new Date().toISOString(),
    },
  ]);

  await removeEq(
    "watched_episodes",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&show_tmdb_id=eq.${progress.tmdbId}`,
  );
  await removeEq(
    "watch_history",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&media_type=eq.tv&tmdb_id=eq.${progress.tmdbId}`,
  );

  const episodeRows = progress.episodes
    .filter((episode) => episode.watched)
    .map((episode) => ({
      firebase_uid: firebaseUid,
      show_tmdb_id: progress.tmdbId,
      season_number: episode.seasonNumber,
      episode_number: episode.episodeNumber,
      episode_key: episode.episodeKey,
      episode_title: episode.episodeTitle,
      watched_at: episode.watchedAt ?? new Date().toISOString(),
      updated_at: episode.updatedAt ?? new Date().toISOString(),
      source: null,
      source_import_id: null,
    }));
  if (episodeRows.length > 0) {
    await upsert(
      "watched_episodes",
      "firebase_uid,show_tmdb_id,season_number,episode_number",
      episodeRows,
    );
  }

  const historyRows = episodeRows.map((episode) => ({
    firebase_uid: firebaseUid,
    history_key: `tv_${progress.tmdbId}_${episode.episode_key}`,
    tmdb_id: progress.tmdbId,
    media_type: "tv",
    title: progress.title,
    season_number: episode.season_number,
    episode_number: episode.episode_number,
    episode_title: episode.episode_title,
    watched_at: episode.watched_at,
    updated_at: episode.updated_at,
    rewatch_count: 0,
    genre_names: [],
    runtime_minutes: null,
  }));
  if (historyRows.length > 0) {
    await upsert("watch_history", "firebase_uid,history_key", historyRows);
  }
}

export async function upsertHistoryShadow(firebaseUid: string, entry: HistoryEntry): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await upsert("watch_history", "firebase_uid,history_key", [
    {
      firebase_uid: firebaseUid,
      history_key: entry.historyId,
      tmdb_id: entry.tmdbId,
      media_type: entry.mediaType,
      title: entry.title,
      season_number: entry.seasonNumber,
      episode_number: entry.episodeNumber,
      episode_title: entry.episodeTitle,
      watched_at: entry.watchedAt ?? new Date().toISOString(),
      updated_at: entry.updatedAt ?? new Date().toISOString(),
      rewatch_count: entry.rewatchCount ?? 0,
      genre_names: entry.genreNames ?? [],
      runtime_minutes: entry.runtimeMinutes ?? null,
    },
  ]);
}

export async function removeHistoryShadow(firebaseUid: string, historyId: string): Promise<void> {
  await removeEq(
    "watch_history",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&history_key=eq.${encodeURIComponent(historyId)}`,
  );
}

export async function upsertFriendshipShadow(
  firebaseUid: string,
  friendFirebaseUid: string,
  status: "pending" | "pending_outgoing" | "pending_incoming" | "accepted" | "blocked",
  displayName: string | null,
  friendCode: string | null,
): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await ensureProfileStubShadow(friendFirebaseUid);
  await upsert("friendships", "firebase_uid,friend_firebase_uid", [
    {
      firebase_uid: firebaseUid,
      friend_firebase_uid: friendFirebaseUid,
      status,
      display_name: displayName,
      friend_code: friendCode,
      updated_at: new Date().toISOString(),
    },
  ]);
}

export async function removeFriendshipShadow(
  firebaseUid: string,
  friendFirebaseUid: string,
): Promise<void> {
  await removeEq(
    "friendships",
    `firebase_uid=eq.${encodeURIComponent(firebaseUid)}&friend_firebase_uid=eq.${encodeURIComponent(friendFirebaseUid)}`,
  );
  await removeEq(
    "friendships",
    `firebase_uid=eq.${encodeURIComponent(friendFirebaseUid)}&friend_firebase_uid=eq.${encodeURIComponent(firebaseUid)}`,
  );
}

export async function upsertDerivedCacheShadow(
  firebaseUid: string,
  cacheKey: string,
  payload: unknown,
): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRpc(env, "upsert_derived_cache", {
    p_firebase_uid: firebaseUid,
    p_cache_key: cacheKey,
    p_payload: payload ?? {},
  });
}

export async function invalidateDerivedCacheShadow(firebaseUid: string): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRpc(env, "invalidate_derived_cache", {
    p_firebase_uid: firebaseUid,
  });
}

export async function getDerivedCacheShadow(
  firebaseUid: string,
  cacheKey: string,
): Promise<{payload: unknown; computedAt: string; invalidatedAt: string | null} | null> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    return null;
  }
  const row = (await supabaseRpc(
    env,
    "get_derived_cache",
    {p_firebase_uid: firebaseUid, p_cache_key: cacheKey},
    "return=representation",
  )) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return null;
  }
  return {
    payload: row.payload,
    computedAt: String(row.computed_at ?? ""),
    invalidatedAt: row.invalidated_at == null ? null : String(row.invalidated_at),
  };
}

export async function markEpisodesWatchedPrimary(input: {
  firebaseUid: string;
  showTmdbId: number;
  title: string;
  posterPath: string | null;
  totalEpisodes: number;
  episodes: Array<{
    season_number: number;
    episode_number: number;
    episode_title: string;
    watched: boolean;
    watched_at?: string | null;
    source?: string | null;
    source_import_id?: string | null;
  }>;
  genreNames?: string[];
  preserveEarliestWatchedAt?: boolean;
}): Promise<Record<string, unknown>> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await ensureProfileStubShadow(input.firebaseUid);
  const row = await supabaseRpc(
    env,
    "mark_episodes_watched",
    {
      p_firebase_uid: input.firebaseUid,
      p_show_tmdb_id: input.showTmdbId,
      p_title: input.title,
      p_poster_path: input.posterPath,
      p_total_episodes: input.totalEpisodes,
      p_episodes: input.episodes,
      p_genre_names: input.genreNames ?? [],
      p_preserve_earliest_watched_at: Boolean(input.preserveEarliestWatchedAt),
    },
    "return=representation",
  );
  if (!row || typeof row !== "object") {
    throw new Error("mark_episodes_watched returned no row");
  }
  return row as Record<string, unknown>;
}

export async function patchShowProgressNextEpisode(
  firebaseUid: string,
  showTmdbId: number,
  next: {seasonNumber: number; episodeNumber: number; episodeTitle: string} | null,
): Promise<void> {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    throw new Error("Supabase is not configured");
  }
  await supabaseRest(
    env,
    `show_progress?firebase_uid=eq.${encodeURIComponent(firebaseUid)}&show_tmdb_id=eq.${showTmdbId}`,
    {
      method: "PATCH",
      body: {
        next_season_number: next?.seasonNumber ?? null,
        next_episode_number: next?.episodeNumber ?? null,
        next_episode_title: next?.episodeTitle ?? null,
        updated_at: new Date().toISOString(),
      },
      prefer: "return=minimal",
    },
  );
}

/** Import job metadata only — staging rows stay Firestore until cutover. */
export async function upsertImportShadow(
  firebaseUid: string,
  job: {
    importId: string;
    provider: string;
    status: string;
    sourceHash?: string | null;
    watchlistStaged?: number;
    episodesStaged?: number;
    watchlistImported?: number;
    episodesImported?: number;
    episodesSkipped?: number;
    episodesFailed?: number;
    errorMessage?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    completedAt?: string | null;
  },
): Promise<void> {
  await ensureProfileStubShadow(firebaseUid);
  await upsert("imports", "id", [
    {
      id: job.importId,
      firebase_uid: firebaseUid,
      provider: job.provider,
      status: job.status,
      summary: {
        sourceHash: job.sourceHash ?? null,
        watchlistStaged: job.watchlistStaged ?? 0,
        episodesStaged: job.episodesStaged ?? 0,
        watchlistImported: job.watchlistImported ?? 0,
        episodesImported: job.episodesImported ?? 0,
        episodesSkipped: job.episodesSkipped ?? 0,
        episodesFailed: job.episodesFailed ?? 0,
        errorMessage: job.errorMessage ?? null,
        completedAt: job.completedAt ?? null,
      },
      created_at: job.createdAt ?? new Date().toISOString(),
      updated_at: job.updatedAt ?? new Date().toISOString(),
    },
  ]);
}
