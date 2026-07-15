import {describe, expect, it} from "vitest";
import {buildImportFromNormalized} from "./tvTimeBuildImport";
import {NormalizedTvTimeExport} from "./tvTimeNormalize";

const normalized: NormalizedTvTimeExport = {
  shows: [
    {
      tvTimeShowId: "100",
      tvShowName: "Silo",
      isFollowed: true,
      isFavorited: false,
      derivedUniqueEpisodeCount: 1,
    },
    {
      tvTimeShowId: "200",
      tvShowName: "Unmapped",
      isFollowed: true,
      isFavorited: false,
      derivedUniqueEpisodeCount: 0,
    },
  ],
  episodes: [
    {
      tvTimeShowId: "100",
      tvTimeEpisodeId: "e1",
      seriesName: "Silo",
      seasonNumber: 1,
      episodeNumber: 2,
      firstRecordedAt: "2024-05-12 03:14:15",
      bulkType: "",
    },
    {
      tvTimeShowId: "200",
      tvTimeEpisodeId: "e2",
      seriesName: "Unmapped",
      seasonNumber: 1,
      episodeNumber: 1,
      firstRecordedAt: "2024-01-01 00:00:00",
      bulkType: "",
    },
  ],
  skippedSeasonZero: 0,
  skippedEpisodeZero: 0,
};

describe("tvTimeBuildImport", () => {
  it("builds watchlist and episode rows for accepted mappings only", () => {
    const payload = buildImportFromNormalized(normalized, [
      {
        sourceShowId: "100",
        tmdbId: 125988,
        title: "Silo",
        poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
        backdrop: null,
      },
    ]);

    expect(payload.watchlist).toEqual([
      {
        tmdbId: 125988,
        mediaType: "tv",
        title: "Silo",
        poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
        backdrop: null,
        status: "watching",
        sourceShowId: "100",
      },
    ]);
    expect(payload.episodes).toEqual([
      {
        tmdbId: 125988,
        seasonNumber: 1,
        episodeNumber: 2,
        watchedAt: "2024-05-12T03:14:15Z",
        sourceShowId: "100",
        sourceEpisodeId: "e1",
        bulkType: null,
      },
    ]);
    expect(payload.skippedUnmappedShows).toBe(1);
    expect(payload.skippedUnmappedEpisodes).toBe(1);
  });
});
