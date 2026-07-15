import {WatchlistStatus} from "../models/watchlist";

const tvStatusRank: Record<string, number> = {
  planned: 1,
  dropped: 2,
  watching: 3,
  completed: 4,
};

const movieStatusRank: Record<string, number> = {
  unwatched: 1,
  watched: 2,
};

export const mergeWatchlistStatus = (
  mediaType: "movie" | "tv",
  existing: WatchlistStatus | null | undefined,
  incoming: WatchlistStatus,
): WatchlistStatus => {
  if (!existing) {
    return incoming;
  }

  const ranks = mediaType === "movie" ? movieStatusRank : tvStatusRank;
  const existingRank = ranks[existing] ?? 0;
  const incomingRank = ranks[incoming] ?? 0;
  return incomingRank > existingRank ? incoming : existing;
};

export const parseImportWatchedAt = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed);
};

export const pickEarliestWatchedAt = (
  existing: Date | null | undefined,
  incoming: Date | null | undefined,
  fallback: Date,
): Date => {
  const candidates = [existing, incoming].filter((value): value is Date => value instanceof Date);
  if (candidates.length === 0) {
    return fallback;
  }

  return candidates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest,
  );
};

export const stagedEpisodeDocId = (tmdbId: number, seasonNumber: number, episodeNumber: number) => {
  const season = String(seasonNumber).padStart(2, "0");
  const episode = String(episodeNumber).padStart(2, "0");
  return `tv_${tmdbId}_s${season}e${episode}`;
};

export const stagedShowDocId = (mediaType: "movie" | "tv", tmdbId: number) =>
  `${mediaType}_${tmdbId}`;
