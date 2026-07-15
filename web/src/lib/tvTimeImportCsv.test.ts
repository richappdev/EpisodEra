import {describe, expect, it} from "vitest";
import {chunkArray, parseEpisodesImportCsv, parseWatchlistImportCsv} from "./tvTimeImportCsv";

describe("tvTimeImportCsv", () => {
  it("parses watchlist and episode import CSVs", () => {
    const watchlist = parseWatchlistImportCsv(`itemId,tmdbId,mediaType,title,poster,backdrop,status,sourceShowId
tv_1396,1396,tv,Breaking Bad,,,watching,72546`);
    expect(watchlist).toEqual([
      {
        tmdbId: 1396,
        mediaType: "tv",
        title: "Breaking Bad",
        poster: null,
        backdrop: null,
        status: "watching",
        sourceShowId: "72546",
      },
    ]);

    const episodes = parseEpisodesImportCsv(`tmdbId,mediaType,seasonNumber,episodeNumber,episodeKey,watchedAt,sourceShowId
1396,tv,1,1,s01e01,2018-01-01T00:00:00Z,72546`);
    expect(episodes[0]).toMatchObject({
      tmdbId: 1396,
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: "2018-01-01T00:00:00Z",
    });
  });

  it("chunks arrays for staged uploads", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
