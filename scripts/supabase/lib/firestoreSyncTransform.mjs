/**
 * Map Supabase library rows → Firestore document payloads (Admin SDK merge shapes).
 */
export function profileDocFromSupabase(row) {
  if (!row?.firebase_uid) {
    return null;
  }
  return {
    firstName: String(row.first_name ?? "User"),
    lastName: String(row.last_name ?? "Unknown"),
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    photoURL: row.photo_url ?? null,
    bio: row.bio ?? null,
    country: row.country ?? null,
    timezone: row.timezone ?? null,
    friendCode: row.friend_code ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function settingsDocFromSupabase(row) {
  if (!row?.firebase_uid) {
    return null;
  }
  const raw = row.raw && typeof row.raw === "object" && !Array.isArray(row.raw) ? row.raw : {};
  return {
    autoMarkPreviousEpisodesWatched: Boolean(raw.autoMarkPreviousEpisodesWatched ?? false),
    language: typeof raw.language === "string" ? raw.language : row.locale ?? "en-US",
    preferredProviderIds: Array.isArray(raw.preferredProviderIds)
      ? raw.preferredProviderIds.filter((id) => Number.isInteger(id) && id > 0)
      : [],
    watchRegion:
      typeof raw.watchRegion === "string" && /^[A-Za-z]{2}$/.test(raw.watchRegion)
        ? raw.watchRegion.toUpperCase()
        : "US",
    achievementsEnabled: raw.achievementsEnabled !== false,
    showAchievementsOnProfile: raw.showAchievementsOnProfile !== false,
    shareActivityWithFriends: Boolean(raw.shareActivityWithFriends),
    allowFriendRequests: raw.allowFriendRequests !== false,
    hideSpoilersUntilWatched:
      raw.hideSpoilersUntilWatched !== undefined
        ? Boolean(raw.hideSpoilersUntilWatched)
        : row.spoiler_mode === "until_watched",
    updatedAt: row.updated_at ?? null,
  };
}

export function watchlistDocFromSupabase(row) {
  const mediaType = row.media_type === "movie" || row.media_type === "tv" ? row.media_type : null;
  const tmdbId = Number(row.tmdb_id);
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  return {
    itemId: `${mediaType}_${tmdbId}`,
    data: {
      tmdbId,
      mediaType,
      title: String(row.title ?? `${mediaType} ${tmdbId}`),
      poster: row.poster_path ?? null,
      backdrop: row.backdrop_path ?? null,
      status: String(row.status ?? (mediaType === "movie" ? "unwatched" : "planned")),
      addedAt: row.added_at ?? null,
      updatedAt: row.updated_at ?? null,
    },
  };
}

export function likeDocFromSupabase(row) {
  const mediaType = row.media_type === "movie" || row.media_type === "tv" ? row.media_type : null;
  const tmdbId = Number(row.tmdb_id);
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  return {
    itemId: `${mediaType}_${tmdbId}`,
    data: {
      tmdbId,
      mediaType,
      title: String(row.title ?? `${mediaType} ${tmdbId}`),
      poster: row.poster_path ?? null,
      backdrop: null,
      likedAt: row.liked_at ?? null,
    },
  };
}

export function progressDocFromSupabase(row) {
  const tmdbId = Number(row.show_tmdb_id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  const nextSeason = row.next_season_number == null ? null : Number(row.next_season_number);
  const nextEpisode = row.next_episode_number == null ? null : Number(row.next_episode_number);
  const keys = Array.isArray(row.watched_episode_keys)
    ? row.watched_episode_keys.filter((k) => typeof k === "string")
    : [];
  return {
    showId: String(tmdbId),
    data: {
      tmdbId,
      title: String(row.title ?? `TV ${tmdbId}`),
      poster: row.poster_path ?? null,
      totalEpisodes: Number(row.total_episodes ?? 0),
      watchedEpisodeCount: Number(row.watched_episode_count ?? keys.length),
      progressPercent: Number(row.progress_percent ?? 0),
      currentSeason: row.current_season == null ? null : Number(row.current_season),
      currentEpisode: row.current_episode == null ? null : Number(row.current_episode),
      nextEpisode:
        nextSeason != null && nextEpisode != null
          ? {
              episodeKey: `s${String(nextSeason).padStart(2, "0")}e${String(nextEpisode).padStart(2, "0")}`,
              seasonNumber: nextSeason,
              episodeNumber: nextEpisode,
              episodeTitle: row.next_episode_title ?? "",
            }
          : null,
      watchedEpisodeKeys: keys,
      updatedAt: row.updated_at ?? null,
    },
  };
}

export function episodeDocFromSupabase(row) {
  const seasonNumber = Number(row.season_number);
  const episodeNumber = Number(row.episode_number);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return null;
  }
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return null;
  }
  const episodeKey =
    typeof row.episode_key === "string" && row.episode_key
      ? row.episode_key
      : `s${String(seasonNumber).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}`;
  return {
    showId: String(row.show_tmdb_id),
    episodeKey,
    data: {
      seasonNumber,
      episodeNumber,
      episodeTitle: row.episode_title ?? "",
      watched: true,
      watchedAt: row.watched_at ?? null,
      updatedAt: row.updated_at ?? null,
      source: row.source ?? null,
      sourceImportId: row.source_import_id ?? null,
    },
  };
}

export function historyDocFromSupabase(row) {
  const mediaType = row.media_type === "movie" || row.media_type === "tv" ? row.media_type : null;
  const tmdbId = Number(row.tmdb_id);
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  const historyId =
    typeof row.history_key === "string" && row.history_key
      ? row.history_key
      : mediaType === "movie"
        ? `movie_${tmdbId}`
        : `tv_${tmdbId}_s${String(row.season_number).padStart(2, "0")}e${String(row.episode_number).padStart(2, "0")}`;
  return {
    historyId,
    data: {
      tmdbId,
      mediaType,
      title: String(row.title ?? `${mediaType} ${tmdbId}`),
      seasonNumber: row.season_number == null ? null : Number(row.season_number),
      episodeNumber: row.episode_number == null ? null : Number(row.episode_number),
      episodeTitle: row.episode_title ?? null,
      watchedAt: row.watched_at ?? null,
      updatedAt: row.updated_at ?? null,
      rewatchCount: Number(row.rewatch_count ?? 0),
      genreNames: Array.isArray(row.genre_names)
        ? row.genre_names.filter((g) => typeof g === "string")
        : [],
      runtimeMinutes: row.runtime_minutes == null ? null : Number(row.runtime_minutes),
    },
  };
}

export function friendDocFromSupabase(row) {
  const friendUid = row.friend_firebase_uid;
  if (!friendUid || friendUid === row.firebase_uid) {
    return null;
  }
  let status = row.status;
  if (status === "pending") {
    status = "pending_outgoing";
  }
  if (status !== "pending_outgoing" && status !== "pending_incoming" && status !== "accepted") {
    status = "accepted";
  }
  return {
    friendUserId: String(friendUid),
    data: {
      status,
      displayName: row.display_name ?? "Friend",
      friendCode: row.friend_code ?? null,
      updatedAt: row.updated_at ?? null,
    },
  };
}

export function derivedDocFromSupabase(cacheKey, envelope) {
  if (!envelope || typeof envelope !== "object") {
    return null;
  }
  return {
    derivedId: cacheKey,
    data: {
      payload: envelope.payload ?? envelope,
      computedAt: envelope.computed_at ?? envelope.computedAt ?? null,
      invalidatedAt: envelope.invalidated_at ?? envelope.invalidatedAt ?? null,
    },
  };
}
