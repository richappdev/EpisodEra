import {ShowProgressSummary} from "../types/progress";
import {WatchlistItem} from "../types/watchlist";

/** Shows with no progress update for this many days move to the dormant bucket. */
export const DORMANT_AFTER_DAYS = 21;

export type ContinuationBucket = "continue" | "dormant";

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isActiveTvWatchlistStatus = (status: WatchlistItem["status"]) =>
  status === "watching" || status === "planned";

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
    if (watchlistItem && !isActiveTvWatchlistStatus(watchlistItem.status)) {
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
  progress: ShowProgressSummary,
): "watching" | "completed" | null => {
  if (progress.watchedEpisodeCount <= 0) {
    return null;
  }

  if (!progress.nextEpisode && progress.watchedEpisodeCount >= progress.totalEpisodes && progress.totalEpisodes > 0) {
    return "completed";
  }

  return "watching";
};
