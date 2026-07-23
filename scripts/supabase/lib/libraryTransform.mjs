/** Pure Firestore → Postgres mappers for watchlist + likes backfill. */

const TV_STATUSES = new Set(["planned", "watching", "completed", "dropped"]);
const MOVIE_STATUSES = new Set(["unwatched", "watched"]);

export function toIso(value) {
  if (!value) {
    return null;
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

export function normalizeMediaType(value) {
  return value === "movie" || value === "tv" ? value : null;
}

export function normalizeWatchlistStatus(mediaType, status) {
  if (typeof status !== "string") {
    return mediaType === "movie" ? "unwatched" : "planned";
  }
  let next = status;
  if (mediaType === "movie") {
    if (status === "completed" || status === "watched") {
      next = "watched";
    } else {
      next = "unwatched";
    }
    return MOVIE_STATUSES.has(next) ? next : "unwatched";
  }
  return TV_STATUSES.has(next) ? next : "planned";
}

export function mapWatchlistRow(firebaseUid, docId, data) {
  const mediaType =
    normalizeMediaType(data.mediaType) ||
    (docId.startsWith("movie_") ? "movie" : docId.startsWith("tv_") ? "tv" : null);
  const tmdbId = Number(data.tmdbId);
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  const title =
    typeof data.title === "string" && data.title.trim() ? data.title.trim() : `${mediaType} ${tmdbId}`;

  return {
    firebase_uid: firebaseUid,
    tmdb_id: tmdbId,
    media_type: mediaType,
    title,
    poster_path:
      typeof data.poster === "string" && data.poster.trim() ? data.poster.trim() : null,
    backdrop_path:
      typeof data.backdrop === "string" && data.backdrop.trim() ? data.backdrop.trim() : null,
    status: normalizeWatchlistStatus(mediaType, data.status),
    added_at: toIso(data.addedAt) ?? new Date().toISOString(),
    updated_at: toIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

export function mapLikeRow(firebaseUid, docId, data) {
  const mediaType =
    normalizeMediaType(data.mediaType) ||
    (docId.startsWith("movie_") ? "movie" : docId.startsWith("tv_") ? "tv" : null);
  const tmdbId = Number(data.tmdbId);
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }
  const title =
    typeof data.title === "string" && data.title.trim() ? data.title.trim() : `${mediaType} ${tmdbId}`;

  return {
    firebase_uid: firebaseUid,
    media_type: mediaType,
    tmdb_id: tmdbId,
    title,
    poster_path:
      typeof data.poster === "string" && data.poster.trim() ? data.poster.trim() : null,
    liked_at: toIso(data.likedAt) ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
