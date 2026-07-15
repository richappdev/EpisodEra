import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {zipSync, strToU8} from "fflate";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {ImportJobSummary} from "../../types/import";
import {ImportTvTimePanel} from "../ImportTvTimePanel";

vi.mock("../../api/client", () => ({
  api: {
    resolveTvTimeShows: vi.fn(),
    createImport: vi.fn(),
    stageImportWatchlist: vi.fn(),
    stageImportEpisodes: vi.fn(),
    commitImport: vi.fn(),
    runImport: vi.fn(),
  },
}));

const completedJob: ImportJobSummary = {
  importId: "imp_1",
  provider: "tv_time",
  status: "completed",
  sourceHash: "x",
  watchlistStaged: 1,
  episodesStaged: 1,
  watchlistImported: 1,
  episodesImported: 1,
  episodesSkipped: 0,
  episodesFailed: 0,
  errorMessage: null,
  createdAt: null,
  updatedAt: null,
  completedAt: null,
};

const makeZipFile = () => {
  const bytes = zipSync({
    "tracking-prod-records-v2.csv": strToU8(`ep_id,s_id,series_name,season_number,episode_number,created_at
e1,100,Silo,1,1,2024-01-01 00:00:00
`),
    "user_tv_show_data.csv": strToU8(`tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
100,Silo,1,0,1
`),
  });
  return new File([bytes], "tvtime-export.zip", {type: "application/zip"});
};

describe("ImportTvTimePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.resolveTvTimeShows).mockResolvedValue({
      accepted: [
        {
          sourceShowId: "100",
          tmdbId: 125988,
          title: "Silo",
          poster: null,
          backdrop: null,
          confidence: 1,
          matchMethod: "exact",
        },
      ],
      skipped: [],
    });
    vi.mocked(api.createImport).mockResolvedValue({import: {...completedJob, status: "draft"}});
    vi.mocked(api.stageImportWatchlist).mockResolvedValue({import: {...completedJob, status: "draft"}});
    vi.mocked(api.stageImportEpisodes).mockResolvedValue({import: {...completedJob, status: "draft"}});
    vi.mocked(api.commitImport).mockResolvedValue({import: {...completedJob, status: "staged"}});
    vi.mocked(api.runImport).mockResolvedValue({
      import: completedJob,
      processedEpisodes: 1,
      remainingEpisodes: 0,
      done: true,
    });
  });

  it("resolves a ZIP then stages and runs the import", async () => {
    render(<ImportTvTimePanel language="en-US" signedIn />);

    const input = screen.getByTestId("tv-time-zip-input") as HTMLInputElement;
    fireEvent.change(input, {target: {files: [makeZipFile()]}});
    fireEvent.click(screen.getByTestId("tv-time-import-start"));

    await waitFor(() => expect(api.resolveTvTimeShows).toHaveBeenCalledWith([
      {sourceShowId: "100", title: "Silo"},
    ]));
    await waitFor(() => expect(api.createImport).toHaveBeenCalled());
    await waitFor(() => expect(api.runImport).toHaveBeenCalledWith("imp_1", 100));
    await waitFor(() => expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent("Import completed."));
  });
});
