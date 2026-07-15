import {EpisodeSummary, TvSeasonDetail, TvSeasonSummary} from "../types/media";
import {ProgressEpisodePointer, ShowProgress, ShowProgressSummary} from "../types/progress";
import {progressPercentFor} from "./continuation";

/** Fallback when TMDb does not provide an episode runtime. */
export const DEFAULT_EPISODE_RUNTIME_MINUTES = 42;

export interface SeasonProgressSnapshot {
  seasonNumber: number;
  title: string;
  totalEpisodes: number;
  watchedCount: number;
  remainingCount: number;
  progressPercent: number;
  completed: boolean;
  estimatedRemainingMinutes: number;
}

export const isAvailableEpisode = (episode: Pick<EpisodeSummary, "airDate">, now: Date = new Date()) => {
  if (!episode.airDate) {
    return true;
  }

  return new Date(`${episode.airDate}T00:00:00`).getTime() <= now.getTime();
};

export const episodeRuntimeMinutes = (episode: Pick<EpisodeSummary, "runtimeMinutes">) =>
  episode.runtimeMinutes && episode.runtimeMinutes > 0 ? episode.runtimeMinutes : DEFAULT_EPISODE_RUNTIME_MINUTES;

export const formatWatchTime = (totalMinutes: number) => {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  return `${hours}h ${remainder}m`;
};

export const watchedCountsBySeason = (progress: ShowProgress | ShowProgressSummary | null) => {
  const counts = new Map<number, number>();
  if (!progress || !("episodes" in progress) || !progress.episodes) {
    return counts;
  }

  for (const episode of progress.episodes) {
    counts.set(episode.seasonNumber, (counts.get(episode.seasonNumber) ?? 0) + 1);
  }

  return counts;
};

export const averageEpisodeRuntimeMinutes = (episodes: EpisodeSummary[]) => {
  const known = episodes
    .map((episode) => episode.runtimeMinutes)
    .filter((runtime): runtime is number => typeof runtime === "number" && runtime > 0);

  if (known.length === 0) {
    return DEFAULT_EPISODE_RUNTIME_MINUTES;
  }

  return Math.round(known.reduce((sum, runtime) => sum + runtime, 0) / known.length);
};

export const estimateRemainingMinutesForEpisodes = (
  episodes: EpisodeSummary[],
  watchedKeys: ReadonlySet<string>,
  now: Date = new Date(),
) =>
  episodes
    .filter((episode) => isAvailableEpisode(episode, now) && !watchedKeys.has(episode.episodeKey))
    .reduce((sum, episode) => sum + episodeRuntimeMinutes(episode), 0);

export const buildSeasonProgressSnapshots = (
  seasons: TvSeasonSummary[],
  progress: ShowProgress | null,
  seasonDetail: TvSeasonDetail | null = null,
  now: Date = new Date(),
): SeasonProgressSnapshot[] => {
  const watchedBySeason = watchedCountsBySeason(progress);
  const watchedKeys = new Set(progress?.episodes.map((episode) => episode.episodeKey) ?? []);
  const averageRuntime = seasonDetail ? averageEpisodeRuntimeMinutes(seasonDetail.episodes) : DEFAULT_EPISODE_RUNTIME_MINUTES;

  return [...seasons]
    .sort((left, right) => left.seasonNumber - right.seasonNumber)
    .map((season) => {
      const totalEpisodes = season.episodeCount;
      const watchedCount = Math.min(watchedBySeason.get(season.seasonNumber) ?? 0, totalEpisodes);
      const remainingCount = Math.max(0, totalEpisodes - watchedCount);
      const completed = totalEpisodes > 0 && watchedCount >= totalEpisodes;

      let estimatedRemainingMinutes = remainingCount * averageRuntime;
      if (seasonDetail?.seasonNumber === season.seasonNumber) {
        const detailedRemaining = estimateRemainingMinutesForEpisodes(seasonDetail.episodes, watchedKeys, now);
        const detailedUnwatchedCount = seasonDetail.episodes.filter(
          (episode) => isAvailableEpisode(episode, now) && !watchedKeys.has(episode.episodeKey),
        ).length;
        const missingEpisodes = Math.max(0, remainingCount - detailedUnwatchedCount);
        estimatedRemainingMinutes = detailedRemaining + missingEpisodes * averageRuntime;
      }

      return {
        seasonNumber: season.seasonNumber,
        title: season.title || `Season ${season.seasonNumber}`,
        totalEpisodes,
        watchedCount,
        remainingCount,
        progressPercent: progressPercentFor(watchedCount, totalEpisodes),
        completed,
        estimatedRemainingMinutes,
      };
    });
};

export const showProgressRemaining = (progress: ShowProgressSummary | null) => {
  if (!progress || progress.totalEpisodes <= 0) {
    return {remainingCount: 0, remainingPercent: 0};
  }

  const remainingCount = Math.max(0, progress.totalEpisodes - progress.watchedEpisodeCount);
  return {
    remainingCount,
    remainingPercent: Math.max(0, Math.round((100 - progress.progressPercent) * 100) / 100),
  };
};

/**
 * Episodes to mark for "Mark previous watched" in the selected season.
 * Catches up prior seasons' remaining available episodes, or fills everything before nextEpisode in-season.
 */
export const previousEpisodesToMark = (
  seasonDetail: TvSeasonDetail,
  watchedKeys: ReadonlySet<string>,
  nextEpisode: ProgressEpisodePointer | null,
  now: Date = new Date(),
) => {
  const availableUnwatched = seasonDetail.episodes
    .filter((episode) => isAvailableEpisode(episode, now) && !watchedKeys.has(episode.episodeKey))
    .sort((left, right) => left.episodeNumber - right.episodeNumber);

  if (!nextEpisode) {
    return [];
  }

  if (nextEpisode.seasonNumber > seasonDetail.seasonNumber) {
    return availableUnwatched;
  }

  if (nextEpisode.seasonNumber < seasonDetail.seasonNumber) {
    return [];
  }

  return availableUnwatched.filter((episode) => episode.episodeNumber < nextEpisode.episodeNumber);
};

export const availableUnwatchedEpisodes = (
  seasonDetail: TvSeasonDetail,
  watchedKeys: ReadonlySet<string>,
  now: Date = new Date(),
) =>
  seasonDetail.episodes
    .filter((episode) => isAvailableEpisode(episode, now) && !watchedKeys.has(episode.episodeKey))
    .sort((left, right) => left.episodeNumber - right.episodeNumber);

export const availableWatchedEpisodes = (
  seasonDetail: TvSeasonDetail,
  watchedKeys: ReadonlySet<string>,
) =>
  seasonDetail.episodes
    .filter((episode) => watchedKeys.has(episode.episodeKey))
    .sort((left, right) => left.episodeNumber - right.episodeNumber);
