import {MediaType} from "../types/media";
import {ShowProgressSummary} from "../types/progress";
import {
  WatchlistItem,
  WatchlistStatus,
  isContinueEligibleStatus,
} from "../types/watchlist";

export type TvProgressStatusSuggestion = "watching" | "completed";

/** Shows with no progress update for this many days move to the dormant / Library stale bucket. */
export const DORMANT_AFTER_DAYS = 14;

/** Remote Config / override key for {@link DORMANT_AFTER_DAYS}. */
export const DORMANT_AFTER_DAYS_REMOTE_KEY = "dormant_after_days";

/**
 * Resolves a dormant-threshold day count from Remote Config (or any raw input).
 * Invalid values fall back to the local fixed default ({@link DORMANT_AFTER_DAYS}).
 */
export const resolveDormantAfterDays = (
  raw: unknown,
  fallback: number = DORMANT_AFTER_DAYS,
): number => {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

/** Cap for the Watchlist Library tab. */
export const LIBRARY_MAX_ITEMS = 20;

export type ContinuationBucket = "continue" | "dormant";

export type LibraryReason = "planned" | "stale" | "completed";

export interface ContinuationEntry {
  key: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  watchlistItem: WatchlistItem | null;
  progress: ShowProgressSummary;
  bucket: ContinuationBucket;
}

export interface ContinuationGroups {
  continueWatching: ContinuationEntry[];
  dormant: ContinuationEntry[];
}

export interface LibraryEntry {
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  watchlistItem: WatchlistItem | null;
  reason: LibraryReason;
  progress: ShowProgressSummary | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const daysSince = (isoDate: string | null | undefined, now: Date = new Date()) => {
  if (!isoDate) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (now.getTime() - parsed) / MS_PER_DAY);
};

export const isDormantProgress = (
  progress: Pick<ShowProgressSummary, "updatedAt">,
  now: Date = new Date(),
  dormantAfterDays = DORMANT_AFTER_DAYS,
) => daysSince(progress.updatedAt, now) >= dormantAfterDays;

const sortByUpdatedAtDesc = (left: ContinuationEntry, right: ContinuationEntry) => {
  const leftTime = Date.parse(left.progress.updatedAt ?? "") || 0;
  const rightTime = Date.parse(right.progress.updatedAt ?? "") || 0;
  return rightTime - leftTime;
};

/**
 * Builds Continue Watching / dormant groups from watchlist + progress.
 * Eligible shows have unwatched next episodes and are not dropped/completed on the watchlist.
 */
export const buildContinuationGroups = (
  watchlistItems: WatchlistItem[],
  progressItems: ShowProgressSummary[],
  now: Date = new Date(),
  dormantAfterDays = DORMANT_AFTER_DAYS,
): ContinuationGroups => {
  const watchlistByShowId = new Map(
    watchlistItems
      .filter((item) => item.mediaType === "tv")
      .map((item) => [String(item.tmdbId), item] as const),
  );

  const continueWatching: ContinuationEntry[] = [];
  const dormant: ContinuationEntry[] = [];

  for (const progress of progressItems) {
    if (progress.watchedEpisodeCount <= 0 || !progress.nextEpisode) {
      continue;
    }

    const watchlistItem = watchlistByShowId.get(progress.showId) ?? null;
    // Exclude dropped/completed watchlist rows; allow watching, planned, or progress-only.
    if (watchlistItem && !isContinueEligibleStatus(watchlistItem.status)) {
      continue;
    }

    const entry: ContinuationEntry = {
      key: watchlistItem?.itemId ?? `progress_${progress.showId}`,
      tmdbId: progress.tmdbId,
      title: watchlistItem?.title ?? progress.title,
      poster: watchlistItem?.poster ?? null,
      watchlistItem,
      progress,
      bucket: isDormantProgress(progress, now, dormantAfterDays) ? "dormant" : "continue",
    };

    if (entry.bucket === "dormant") {
      dormant.push(entry);
    } else {
      continueWatching.push(entry);
    }
  }

  continueWatching.sort(sortByUpdatedAtDesc);
  dormant.sort(sortByUpdatedAtDesc);

  return {continueWatching, dormant};
};

/**
 * Library tab: stale (dormant) watching, planned, and completed/watched — capped.
 * Stale titles are listed first so they surface for re-engagement.
 */
export const buildLibraryEntries = (
  watchlistItems: WatchlistItem[],
  progressItems: ShowProgressSummary[],
  now: Date = new Date(),
  maxItems = LIBRARY_MAX_ITEMS,
  dormantAfterDays = DORMANT_AFTER_DAYS,
): LibraryEntry[] => {
  const {dormant} = buildContinuationGroups(watchlistItems, progressItems, now, dormantAfterDays);
  const seen = new Set<string>();
  const entries: LibraryEntry[] = [];

  const add = (entry: LibraryEntry) => {
    const id = `${entry.mediaType}_${entry.tmdbId}`;
    if (seen.has(id) || entries.length >= maxItems) {
      return;
    }
    seen.add(id);
    entries.push(entry);
  };

  for (const entry of dormant) {
    add({
      key: entry.key,
      tmdbId: entry.tmdbId,
      mediaType: "tv",
      title: entry.title,
      poster: entry.poster,
      watchlistItem: entry.watchlistItem,
      reason: "stale",
      progress: entry.progress,
    });
  }

  for (const item of watchlistItems) {
    if (item.status === "planned") {
      add({
        key: item.itemId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        poster: item.poster,
        watchlistItem: item,
        reason: "planned",
        progress: null,
      });
    }
  }

  for (const item of watchlistItems) {
    if (item.status === "completed" || item.status === "watched") {
      add({
        key: item.itemId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        poster: item.poster,
        watchlistItem: item,
        reason: "completed",
        progress: null,
      });
    }
  }

  return entries;
};

/** Active queue: watching / unwatched, excluding dormant titles that belong in Library. */
export const selectActiveWatchlistItems = (
  watchlistItems: WatchlistItem[],
  progressItems: ShowProgressSummary[],
  now: Date = new Date(),
  dormantAfterDays = DORMANT_AFTER_DAYS,
) => {
  const {dormant} = buildContinuationGroups(watchlistItems, progressItems, now, dormantAfterDays);
  const dormantIds = new Set(dormant.map((entry) => entry.tmdbId));

  return watchlistItems.filter((item) => {
    if (item.mediaType === "tv" && dormantIds.has(item.tmdbId)) {
      return false;
    }
    return item.status === "watching" || item.status === "unwatched";
  });
};

export const nextEpisodeLabelFor = (progress: ShowProgressSummary) => {
  if (!progress.nextEpisode) {
    return "Next episode";
  }

  return `Next up S${progress.nextEpisode.seasonNumber} E${progress.nextEpisode.episodeNumber}`;
};

export const progressPercentFor = (watchedEpisodeCount: number, totalEpisodes: number) =>
  totalEpisodes > 0 ? Math.round((watchedEpisodeCount / totalEpisodes) * 10000) / 100 : 0;

/**
 * Local optimistic progress after marking the current next episode watched.
 * Keeps `nextEpisode` until the server responds so Continue Watching cards do not flicker;
 * callers must disable repeat taps via a pending lock.
 */
export const optimisticMarkNextEpisode = (progress: ShowProgressSummary): ShowProgressSummary => {
  if (!progress.nextEpisode) {
    return progress;
  }

  const watchedEpisodeCount = Math.min(progress.watchedEpisodeCount + 1, progress.totalEpisodes);

  return {
    ...progress,
    watchedEpisodeCount,
    progressPercent: progressPercentFor(watchedEpisodeCount, progress.totalEpisodes),
    currentSeason: progress.nextEpisode.seasonNumber,
    currentEpisode: progress.nextEpisode.episodeNumber,
    updatedAt: new Date().toISOString(),
  };
};

export const suggestedWatchlistStatusForProgress = (
  progress: Pick<ShowProgressSummary, "watchedEpisodeCount" | "totalEpisodes" | "nextEpisode">,
): TvProgressStatusSuggestion | null => {
  if (progress.watchedEpisodeCount <= 0) {
    return null;
  }

  if (!progress.nextEpisode && progress.watchedEpisodeCount >= progress.totalEpisodes && progress.totalEpisodes > 0) {
    return "completed";
  }

  return "watching";
};

/** Auto-promotion only: planned → watching, planned|watching → completed. Never demotes. */
export const promotedTvWatchlistStatus = (
  currentStatus: WatchlistStatus,
  suggested: TvProgressStatusSuggestion | null,
): TvProgressStatusSuggestion | null => {
  if (!suggested || currentStatus === suggested || currentStatus === "dropped") {
    return null;
  }

  if (suggested === "watching" && currentStatus !== "planned") {
    return null;
  }

  if (suggested === "completed" && currentStatus !== "watching" && currentStatus !== "planned") {
    return null;
  }

  return suggested;
};
