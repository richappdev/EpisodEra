import {describe, expect, it} from "vitest";
import {
  buildImportReportCsv,
  buildImportReportFilename,
  importReportHasDownloadableRows,
} from "./importReportCsv";
import {ImportReport} from "../types/import";

const sampleReport: ImportReport = {
  generatedAt: "2026-07-26T12:00:00.000Z",
  failedEpisodeCount: 1,
  skippedEpisodeCount: 1,
  skippedShowCount: 1,
  truncated: false,
  rows: [
    {
      kind: "skipped_show",
      title: 'Show, "quoted"',
      tmdbId: null,
      seasonNumber: null,
      episodeNumber: null,
      reason: "unresolved",
      sourceShowId: "200",
    },
    {
      kind: "failed_episode",
      title: "Silo",
      tmdbId: 125988,
      seasonNumber: 1,
      episodeNumber: 99,
      reason: "episode_not_found_in_tmdb",
      sourceShowId: "100",
    },
  ],
};

describe("importReportCsv", () => {
  it("detects downloadable report content", () => {
    expect(importReportHasDownloadableRows(null)).toBe(false);
    expect(importReportHasDownloadableRows({...sampleReport, rows: [], failedEpisodeCount: 0, skippedEpisodeCount: 0, skippedShowCount: 0})).toBe(false);
    expect(importReportHasDownloadableRows(sampleReport)).toBe(true);
  });

  it("builds a CSV with escaped fields", () => {
    const csv = buildImportReportCsv(sampleReport);
    expect(csv).toContain("kind,title,tmdbId,seasonNumber,episodeNumber,reason,sourceShowId");
    expect(csv).toContain('"Show, ""quoted"""');
    expect(csv).toContain("failed_episode,Silo,125988,1,99,episode_not_found_in_tmdb,100");
  });

  it("builds a stable download filename", () => {
    expect(buildImportReportFilename("imp_abc12345", "2026-07-26T12:00:00.000Z")).toBe(
      "episodera-import-report-imp_abc1-2026-07-26.csv",
    );
  });
});
