import {unzipSync, strFromU8} from "fflate";
import {describe, expect, it} from "vitest";
import {EXPORT_SCHEMA_VERSION, UserDataExport} from "../../types/export";
import {buildExportZipBytes, buildExportZipFilename} from "../exportZip";

const sampleExport: UserDataExport = {
  manifest: {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: "2026-07-17T12:34:56.000Z",
    userId: "user-1",
    counts: {
      history: 1,
      progressShows: 0,
      progressEpisodes: 0,
      watchlist: 0,
    },
  },
  history: [
    {
      historyId: "movie_550",
      tmdbId: 550,
      mediaType: "movie",
      title: "Fight Club",
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
      watchedAt: "2026-07-10T07:00:00.000Z",
      updatedAt: "2026-07-10T07:00:00.000Z",
      rewatchCount: 0,
    },
  ],
  progress: [],
  watchlist: [],
};

describe("exportZip", () => {
  it("builds a dated zip filename", () => {
    expect(buildExportZipFilename("2026-07-17T12:34:56.000Z")).toBe("episodera-export-2026-07-17.zip");
  });

  it("packages manifest, history, progress, and watchlist JSON members", () => {
    const archive = unzipSync(buildExportZipBytes(sampleExport));
    const names = Object.keys(archive).sort();

    expect(names).toEqual(["history.json", "manifest.json", "progress.json", "watchlist.json"]);
    expect(JSON.parse(strFromU8(archive["manifest.json"]))).toEqual(sampleExport.manifest);
    expect(JSON.parse(strFromU8(archive["history.json"]))).toEqual(sampleExport.history);
    expect(JSON.parse(strFromU8(archive["progress.json"]))).toEqual([]);
    expect(JSON.parse(strFromU8(archive["watchlist.json"]))).toEqual([]);
  });
});
