import {ImportEpisodeInput, ImportWatchlistItemInput} from "../types/import";
import {NormalizedTvTimeExport, NormalizedTvTimeShow} from "./tvTimeNormalize";

export interface AcceptedShowMapping {
  sourceShowId: string;
  tmdbId: number;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
}

export interface TvTimeImportPayload {
  watchlist: ImportWatchlistItemInput[];
  episodes: ImportEpisodeInput[];
  skippedUnmappedEpisodes: number;
  skippedUnmappedShows: number;
}

const parseTimestamp = (value: string): string | null => {
  if (!value) {
    return null;
  }
  for (const pattern of [/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/, /^(\d{4}-\d{2}-\d{2})/]) {
    const match = value.match(pattern);
    if (!match) {
      continue;
    }
    if (match[2]) {
      return `${match[1]}T${match[2]}Z`;
    }
    return `${match[1]}T00:00:00Z`;
  }
  return null;
};

const watchlistStatus = (show: NormalizedTvTimeShow, watchedCount: number): string => {
  if (watchedCount > 0) {
    return "watching";
  }
  if (show.isFollowed) {
    return "planned";
  }
  return "planned";
};

export const buildImportFromNormalized = (
  normalized: NormalizedTvTimeExport,
  mappings: AcceptedShowMapping[],
): TvTimeImportPayload => {
  const mappingByShow = new Map(mappings.map((row) => [row.sourceShowId, row]));
  const watchedByTmdb = new Map<number, number>();
  const episodes: ImportEpisodeInput[] = [];
  let skippedUnmappedEpisodes = 0;

  for (const episode of normalized.episodes) {
    const mapping = mappingByShow.get(episode.tvTimeShowId);
    if (!mapping) {
      skippedUnmappedEpisodes += 1;
      continue;
    }
    episodes.push({
      tmdbId: mapping.tmdbId,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      watchedAt: parseTimestamp(episode.firstRecordedAt),
      sourceShowId: episode.tvTimeShowId,
      sourceEpisodeId: episode.tvTimeEpisodeId || null,
      bulkType: episode.bulkType || null,
    });
    watchedByTmdb.set(mapping.tmdbId, (watchedByTmdb.get(mapping.tmdbId) ?? 0) + 1);
  }

  episodes.sort((left, right) => {
    if (left.tmdbId !== right.tmdbId) {
      return left.tmdbId - right.tmdbId;
    }
    if (left.seasonNumber !== right.seasonNumber) {
      return left.seasonNumber - right.seasonNumber;
    }
    return left.episodeNumber - right.episodeNumber;
  });

  const watchlist: ImportWatchlistItemInput[] = [];
  let skippedUnmappedShows = 0;
  for (const show of normalized.shows) {
    const mapping = mappingByShow.get(show.tvTimeShowId);
    if (!mapping) {
      skippedUnmappedShows += 1;
      continue;
    }
    const watchedCount = watchedByTmdb.get(mapping.tmdbId) ?? 0;
    if (!show.isFollowed && watchedCount === 0) {
      continue;
    }
    watchlist.push({
      tmdbId: mapping.tmdbId,
      mediaType: "tv",
      title: mapping.title || show.tvShowName || `TMDb ${mapping.tmdbId}`,
      poster: mapping.poster ?? null,
      backdrop: mapping.backdrop ?? null,
      status: watchlistStatus(show, watchedCount),
      sourceShowId: show.tvTimeShowId,
    });
  }

  watchlist.sort((left, right) =>
    left.title.localeCompare(right.title, undefined, {sensitivity: "base"}),
  );

  return {
    watchlist,
    episodes,
    skippedUnmappedEpisodes,
    skippedUnmappedShows,
  };
};
