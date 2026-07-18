import {EpisodeProgress, ProgressEpisodePointer, ShowProgressSummary} from "../models/progress";
import {EpisodeSummary, TvSeasonDetail} from "../models/media";
import {WatchlistStatus} from "../models/watchlist";

export type TvProgressStatusSuggestion = "watching" | "completed";

export const episodeKeyFor = (seasonNumber: number, episodeNumber: number) =>
  `s${String(seasonNumber).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}`;

export const compareEpisodeCoordinates = (
  left: Pick<EpisodeProgress, "seasonNumber" | "episodeNumber">,
  right: Pick<EpisodeProgress, "seasonNumber" | "episodeNumber">,
) => {
  if (left.seasonNumber !== right.seasonNumber) {
    return left.seasonNumber - right.seasonNumber;
  }

  return left.episodeNumber - right.episodeNumber;
};

export const progressPercentFor = (watchedEpisodeCount: number, totalEpisodes: number) =>
  totalEpisodes > 0 ? Math.round((watchedEpisodeCount / totalEpisodes) * 10000) / 100 : 0;

/**
 * Suggests a TV watchlist status from progress completeness.
 * Uses episode completeness (no next episode + full count), not raw percent.
 */
export const suggestedWatchlistStatusForProgress = (
  progress: Pick<ShowProgressSummary, "watchedEpisodeCount" | "totalEpisodes" | "nextEpisode">,
): TvProgressStatusSuggestion | null => {
  if (progress.watchedEpisodeCount <= 0) {
    return null;
  }

  if (
    !progress.nextEpisode &&
    progress.watchedEpisodeCount >= progress.totalEpisodes &&
    progress.totalEpisodes > 0
  ) {
    return "completed";
  }

  return "watching";
};

/**
 * Auto-promotion only: planned → watching, planned|watching → completed.
 * Never touches dropped, and never demotes completed.
 */
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

export const toEpisodePointer = (episode: EpisodeSummary): ProgressEpisodePointer => ({
  episodeKey: episode.episodeKey,
  seasonNumber: episode.seasonNumber,
  episodeNumber: episode.episodeNumber,
  episodeTitle: episode.title || `Episode ${episode.episodeNumber}`,
});

export const findNextUnwatchedEpisode = (
  seasons: TvSeasonDetail[],
  watchedEpisodeKeys: Set<string>,
): ProgressEpisodePointer | null => {
  const sortedSeasons = [...seasons].sort((left, right) => left.seasonNumber - right.seasonNumber);

  for (const season of sortedSeasons) {
    const episode = [...season.episodes]
      .sort(compareEpisodeCoordinates)
      .find((candidate) => !watchedEpisodeKeys.has(candidate.episodeKey));

    if (episode) {
      return toEpisodePointer(episode);
    }
  }

  return null;
};
