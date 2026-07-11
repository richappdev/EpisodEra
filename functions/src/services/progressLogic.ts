import {EpisodeProgress, ProgressEpisodePointer} from "../models/progress";
import {EpisodeSummary, TvSeasonDetail} from "../models/media";

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
