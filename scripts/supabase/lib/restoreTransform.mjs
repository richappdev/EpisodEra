/**
 * Map a site-export dump into Supabase row batches.
 * Shared by import-supabase-site.mjs
 */
import {mapProfileRow, mapSettingsRow} from "./profileTransform.mjs";
import {mapLikeRow, mapWatchlistRow} from "./libraryTransform.mjs";

const FRIEND_STATUS_MAP = {
  pending_outgoing: "pending",
  pending_incoming: "pending",
  pending: "pending",
  accepted: "accepted",
  blocked: "blocked",
};

export function mapFriendRow(firebaseUid, friendUid, data) {
  if (!friendUid || friendUid === firebaseUid) {
    return null;
  }
  const rawStatus = typeof data.status === "string" ? data.status : "pending";
  const status = FRIEND_STATUS_MAP[rawStatus] ?? "pending";
  return {
    firebase_uid: firebaseUid,
    friend_firebase_uid: friendUid,
    status,
    friend_code:
      typeof data.friendCode === "string" && /^[A-Z0-9]{6}$/i.test(data.friendCode)
        ? data.friendCode.toUpperCase()
        : null,
    display_name:
      typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : null,
    created_at: data.createdAt ?? data.updatedAt ?? new Date().toISOString(),
    updated_at: data.updatedAt ?? new Date().toISOString(),
  };
}

export function mapShowProgressRow(firebaseUid, showId, data) {
  const showTmdbId = Number(data.tmdbId ?? showId);
  if (!Number.isInteger(showTmdbId) || showTmdbId <= 0) {
    return null;
  }
  const next = data.nextEpisode && typeof data.nextEpisode === "object" ? data.nextEpisode : null;
  const keys = Array.isArray(data.watchedEpisodeKeys)
    ? data.watchedEpisodeKeys.filter((k) => typeof k === "string")
    : [];
  return {
    firebase_uid: firebaseUid,
    show_tmdb_id: showTmdbId,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : `TV ${showTmdbId}`,
    poster_path: typeof data.poster === "string" && data.poster.trim() ? data.poster.trim() : null,
    total_episodes: Number.isInteger(data.totalEpisodes) ? Math.max(0, data.totalEpisodes) : 0,
    watched_episode_count: Number.isInteger(data.watchedEpisodeCount)
      ? Math.max(0, data.watchedEpisodeCount)
      : keys.length,
    progress_percent:
      typeof data.progressPercent === "number" && Number.isFinite(data.progressPercent)
        ? Math.min(100, Math.max(0, data.progressPercent))
        : 0,
    current_season: Number.isInteger(data.currentSeason) ? data.currentSeason : null,
    current_episode: Number.isInteger(data.currentEpisode) ? data.currentEpisode : null,
    next_season_number: next && Number.isInteger(next.seasonNumber) ? next.seasonNumber : null,
    next_episode_number: next && Number.isInteger(next.episodeNumber) ? next.episodeNumber : null,
    next_episode_title:
      next && typeof next.episodeTitle === "string" ? next.episodeTitle : null,
    watched_episode_keys: keys.slice(0, 2000),
    updated_at: data.updatedAt ?? new Date().toISOString(),
  };
}

export function mapWatchedEpisodeRow(firebaseUid, showTmdbId, episodeId, data) {
  const seasonNumber = Number(data.seasonNumber);
  const episodeNumber = Number(data.episodeNumber);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
    return null;
  }
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return null;
  }
  if (data.watched === false) {
    return null;
  }
  const episodeKey =
    typeof data.episodeKey === "string" && data.episodeKey
      ? data.episodeKey
      : typeof episodeId === "string" && episodeId
        ? episodeId
        : `s${String(seasonNumber).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}`;

  return {
    firebase_uid: firebaseUid,
    show_tmdb_id: showTmdbId,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    episode_key: episodeKey,
    episode_title:
      typeof data.episodeTitle === "string" && data.episodeTitle.trim()
        ? data.episodeTitle.trim()
        : null,
    watched_at: data.watchedAt ?? new Date().toISOString(),
    updated_at: data.updatedAt ?? new Date().toISOString(),
    source:
      typeof data.source === "string" &&
      ["tv_time", "manual", "bulk_season", "bulk_fill_previous"].includes(data.source)
        ? data.source
        : null,
    source_import_id:
      typeof data.sourceImportId === "string" ? data.sourceImportId : null,
  };
}

export function mapHistoryRow(firebaseUid, historyId, data) {
  const tmdbId = Number(data.tmdbId);
  const mediaType = data.mediaType === "movie" || data.mediaType === "tv" ? data.mediaType : null;
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  const historyKey =
    typeof historyId === "string" && historyId
      ? historyId
      : mediaType === "movie"
        ? `movie_${tmdbId}`
        : `tv_${tmdbId}_s${String(data.seasonNumber).padStart(2, "0")}e${String(data.episodeNumber).padStart(2, "0")}`;

  return {
    firebase_uid: firebaseUid,
    history_key: historyKey,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : `${mediaType} ${tmdbId}`,
    season_number: Number.isInteger(data.seasonNumber) ? data.seasonNumber : null,
    episode_number: Number.isInteger(data.episodeNumber) ? data.episodeNumber : null,
    episode_title:
      typeof data.episodeTitle === "string" && data.episodeTitle.trim()
        ? data.episodeTitle.trim()
        : null,
    watched_at: data.watchedAt ?? new Date().toISOString(),
    updated_at: data.updatedAt ?? new Date().toISOString(),
    rewatch_count:
      typeof data.rewatchCount === "number" && data.rewatchCount > 0 ? data.rewatchCount : 0,
    genre_names: Array.isArray(data.genreNames)
      ? data.genreNames.filter((g) => typeof g === "string" && g.trim())
      : [],
    runtime_minutes:
      typeof data.runtimeMinutes === "number" && Number.isFinite(data.runtimeMinutes)
        ? data.runtimeMinutes
        : null,
  };
}

export function buildUserRestoreBatches(userDump, authEmail = null) {
  const uid = userDump.uid;
  const profile = mapProfileRow(uid, userDump.profile?.data ?? {}, authEmail);
  const settings = mapSettingsRow(uid, userDump.settings?.data ?? {});

  const watchlist = [];
  for (const doc of userDump.watchlist ?? []) {
    const row = mapWatchlistRow(uid, doc.id, doc.data ?? {});
    if (row) {
      watchlist.push(row);
    }
  }

  const likes = [];
  for (const doc of userDump.likes ?? []) {
    const row = mapLikeRow(uid, doc.id, doc.data ?? {});
    if (row) {
      likes.push(row);
    }
  }

  const progress = [];
  const episodes = [];
  for (const show of userDump.progress ?? []) {
    const progressRow = mapShowProgressRow(uid, show.id, show.data ?? {});
    if (!progressRow) {
      continue;
    }
    progress.push(progressRow);
    for (const ep of show.episodes ?? []) {
      const epRow = mapWatchedEpisodeRow(uid, progressRow.show_tmdb_id, ep.id, ep.data ?? {});
      if (epRow) {
        episodes.push(epRow);
      }
    }
  }

  const history = [];
  for (const doc of userDump.history ?? []) {
    const row = mapHistoryRow(uid, doc.id, doc.data ?? {});
    if (row) {
      history.push(row);
    }
  }

  const friendships = [];
  for (const doc of userDump.friends ?? []) {
    const row = mapFriendRow(uid, doc.id, doc.data ?? {});
    if (row) {
      friendships.push(row);
    }
  }

  return {profile, settings, watchlist, likes, progress, episodes, history, friendships};
}
