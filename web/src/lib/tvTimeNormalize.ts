import {parseCsv} from "./tvTimeImportCsv";
import {TvTimeZipCsvs} from "./tvTimeZip";

export interface NormalizedTvTimeEpisode {
  tvTimeShowId: string;
  tvTimeEpisodeId: string;
  seriesName: string;
  seasonNumber: number;
  episodeNumber: number;
  firstRecordedAt: string;
  bulkType: string;
}

export interface NormalizedTvTimeShow {
  tvTimeShowId: string;
  tvShowName: string;
  isFollowed: boolean;
  isFavorited: boolean;
  derivedUniqueEpisodeCount: number;
}

export interface NormalizedTvTimeExport {
  shows: NormalizedTvTimeShow[];
  episodes: NormalizedTvTimeEpisode[];
  skippedSeasonZero: number;
  skippedEpisodeZero: number;
}

const truthy = (value: string | undefined): boolean =>
  ["1", "true", "yes"].includes(String(value ?? "").toLowerCase());

const integer = (value: string | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const episodeGroupKey = (row: Record<string, string>): string => {
  if (row.ep_id) {
    return `id:${row.ep_id}`;
  }
  const season = row.season_number || row.s_no || "";
  const episode = row.episode_number || row.ep_no || "";
  return `coordinate:${row.s_id ?? ""}:${season}:${episode}`;
};

const earliestTimestamp = (values: string[]): string => {
  const sorted = values.filter(Boolean).sort();
  return sorted[0] ?? "";
};

export const normalizeTvTimeExport = (csvs: TvTimeZipCsvs): NormalizedTvTimeExport => {
  const trackingRows = parseCsv(csvs.tracking);
  const showRows = parseCsv(csvs.shows);

  const episodeGroups = new Map<string, Record<string, string>[]>();
  for (const row of trackingRows) {
    if (!row.ep_id) {
      continue;
    }
    const key = episodeGroupKey(row);
    const group = episodeGroups.get(key) ?? [];
    group.push(row);
    episodeGroups.set(key, group);
  }

  const episodeCountsByShow = new Map<string, number>();
  const allEpisodes: NormalizedTvTimeEpisode[] = [];
  let skippedSeasonZero = 0;
  let skippedEpisodeZero = 0;

  for (const rows of episodeGroups.values()) {
    const preferred = rows[0];
    const showId = preferred.s_id ?? "";
    const seasonNumber = integer(preferred.season_number || preferred.s_no);
    const episodeNumber = integer(preferred.episode_number || preferred.ep_no);
    episodeCountsByShow.set(showId, (episodeCountsByShow.get(showId) ?? 0) + 1);

    if (seasonNumber <= 0) {
      skippedSeasonZero += 1;
      continue;
    }
    if (episodeNumber <= 0) {
      skippedEpisodeZero += 1;
      continue;
    }

    allEpisodes.push({
      tvTimeShowId: showId,
      tvTimeEpisodeId: preferred.ep_id ?? "",
      seriesName: preferred.series_name ?? "",
      seasonNumber,
      episodeNumber,
      firstRecordedAt: earliestTimestamp(rows.map((row) => row.created_at ?? "")),
      bulkType: preferred.bulk_type ?? "",
    });
  }

  allEpisodes.sort((left, right) => {
    const nameCmp = left.seriesName.localeCompare(right.seriesName, undefined, {sensitivity: "base"});
    if (nameCmp !== 0) {
      return nameCmp;
    }
    if (left.seasonNumber !== right.seasonNumber) {
      return left.seasonNumber - right.seasonNumber;
    }
    return left.episodeNumber - right.episodeNumber;
  });

  const groupedShows = new Map<string, Record<string, string>[]>();
  for (const row of showRows) {
    const showId = row.tv_show_id ?? "";
    if (!showId) {
      continue;
    }
    const group = groupedShows.get(showId) ?? [];
    group.push(row);
    groupedShows.set(showId, group);
  }

  const trackerShowRows = new Map<string, Record<string, string>[]>();
  for (const row of trackingRows) {
    if (row.s_id && !row.ep_id && row.is_followed !== "") {
      const group = trackerShowRows.get(row.s_id) ?? [];
      group.push(row);
      trackerShowRows.set(row.s_id, group);
    }
  }

  for (const [showId, rows] of trackerShowRows) {
    if (groupedShows.has(showId)) {
      continue;
    }
    groupedShows.set(
      showId,
      rows.map((row) => ({
        tv_show_id: showId,
        tv_show_name: row.series_name ?? "",
        is_followed: row.is_followed ?? "",
        is_favorited: "0",
        nb_episodes_seen: row.ep_watch_count ?? "",
      })),
    );
  }

  const shows: NormalizedTvTimeShow[] = [];
  for (const [showId, rows] of groupedShows) {
    const preferred = rows[0];
    shows.push({
      tvTimeShowId: showId,
      tvShowName: preferred.tv_show_name ?? "",
      isFollowed: rows.some((row) => truthy(row.is_followed)),
      isFavorited: rows.some((row) => truthy(row.is_favorited)),
      derivedUniqueEpisodeCount: episodeCountsByShow.get(showId) ?? 0,
    });
  }

  shows.sort((left, right) =>
    left.tvShowName.localeCompare(right.tvShowName, undefined, {sensitivity: "base"}),
  );

  return {
    shows,
    episodes: allEpisodes,
    skippedSeasonZero,
    skippedEpisodeZero,
  };
};
