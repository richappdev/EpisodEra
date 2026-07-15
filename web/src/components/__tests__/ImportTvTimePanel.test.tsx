import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {zipSync, strToU8} from "fflate";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {ImportJobSummary, ImportRunResult} from "../../types/import";
import {ImportTvTimePanel} from "../ImportTvTimePanel";

vi.mock("../../api/client", () => ({
  api: {
    resolveTvTimeShows: vi.fn(),
    upsertMediaMapping: vi.fn(),
    detail: vi.fn(),
    createImport: vi.fn(),
    stageImportWatchlist: vi.fn(),
    stageImportEpisodes: vi.fn(),
    commitImport: vi.fn(),
    runImport: vi.fn(),
  },
}));

const baseJob: ImportJobSummary = {
  importId: "imp_1",
  provider: "tv_time",
  status: "draft",
  sourceHash: "x",
  watchlistStaged: 1,
  episodesStaged: 2,
  watchlistImported: 0,
  episodesImported: 0,
  episodesSkipped: 0,
  episodesFailed: 0,
  errorMessage: null,
  createdAt: null,
  updatedAt: null,
  completedAt: null,
};

const makeZipFile = (secondShow = false) => {
  const tracking = secondShow
    ? `ep_id,s_id,series_name,season_number,episode_number,created_at
e1,100,Silo,1,1,2024-01-01 00:00:00
e2,100,Silo,1,2,2024-01-02 00:00:00
e3,200,Mystery Show,1,1,2024-01-03 00:00:00
`
    : `ep_id,s_id,series_name,season_number,episode_number,created_at
e1,100,Silo,1,1,2024-01-01 00:00:00
e2,100,Silo,1,2,2024-01-02 00:00:00
`;
  const shows = secondShow
    ? `tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
100,Silo,1,0,2
200,Mystery Show,1,0,1
`
    : `tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
100,Silo,1,0,2
`;
  const bytes = zipSync({
    "tracking-prod-records-v2.csv": strToU8(tracking),
    "user_tv_show_data.csv": strToU8(shows),
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
    vi.mocked(api.upsertMediaMapping).mockResolvedValue({
      mapping: {
        provider: "tv_time",
        mediaType: "tv",
        externalId: "200",
        tmdbId: 999,
        title: "Picked",
        updatedBy: "u1",
        updatedAt: null,
      },
    });
    vi.mocked(api.createImport).mockResolvedValue({import: {...baseJob, status: "draft"}});
    vi.mocked(api.stageImportWatchlist).mockResolvedValue({
      import: {...baseJob, status: "draft", watchlistStaged: 1},
    });
    vi.mocked(api.stageImportEpisodes).mockResolvedValue({
      import: {...baseJob, status: "draft", episodesStaged: 2},
    });
    vi.mocked(api.commitImport).mockResolvedValue({
      import: {...baseJob, status: "staged", watchlistStaged: 1, episodesStaged: 2},
    });
  });

  it("shows live import counts while the backend is still processing", async () => {
    let resolveFirstRun: ((value: ImportRunResult) => void) | undefined;
    let resolveSecondRun: ((value: ImportRunResult) => void) | undefined;
    const firstRun = new Promise<ImportRunResult>((resolve) => {
      resolveFirstRun = resolve;
    });
    const secondRun = new Promise<ImportRunResult>((resolve) => {
      resolveSecondRun = resolve;
    });

    vi.mocked(api.runImport)
      .mockImplementationOnce(() => firstRun)
      .mockImplementationOnce(() => secondRun);

    render(<ImportTvTimePanel language="en-US" signedIn />);

    const input = screen.getByTestId("tv-time-zip-input") as HTMLInputElement;
    fireEvent.change(input, {target: {files: [makeZipFile()]}});
    fireEvent.click(screen.getByTestId("tv-time-import-start"));

    await waitFor(() => expect(api.runImport).toHaveBeenCalledTimes(1));

    resolveFirstRun?.({
      import: {
        ...baseJob,
        status: "running",
        watchlistImported: 1,
        episodesImported: 1,
        episodesStaged: 2,
      },
      processedEpisodes: 1,
      remainingEpisodes: 1,
      done: false,
    });

    await waitFor(() =>
      expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent(
        "Still processing… Imported 1 / 2 episodes (0 already present, 0 failed) · 1 remaining · 1 watchlist merges",
      ),
    );

    await waitFor(() => expect(api.runImport).toHaveBeenCalledTimes(2));

    resolveSecondRun?.({
      import: {
        ...baseJob,
        status: "completed",
        watchlistImported: 1,
        episodesImported: 2,
        episodesStaged: 2,
      },
      processedEpisodes: 1,
      remainingEpisodes: 0,
      done: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent(
        "Import completed. 2 / 2 episodes imported (0 already present, 0 failed) · 1 watchlist merges",
      ),
    );
  });

  it("pauses for mapping review when shows are unmatched", async () => {
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
      skipped: [
        {
          sourceShowId: "200",
          title: "Mystery Show",
          reason: "ambiguous",
          confidence: 0.85,
          notes: "Close runner-up",
          candidates: [
            {
              tmdbId: 111,
              title: "Mystery Show",
              poster: null,
              backdrop: null,
              year: "2020",
            },
            {
              tmdbId: 222,
              title: "Mystery Shows",
              poster: null,
              backdrop: null,
              year: "2019",
            },
          ],
        },
      ],
    });
    vi.mocked(api.runImport).mockResolvedValue({
      import: {
        ...baseJob,
        status: "completed",
        watchlistImported: 2,
        episodesImported: 3,
        episodesStaged: 3,
      },
      processedEpisodes: 3,
      remainingEpisodes: 0,
      done: true,
    });

    render(<ImportTvTimePanel language="en-US" signedIn />);

    fireEvent.change(screen.getByTestId("tv-time-zip-input"), {
      target: {files: [makeZipFile(true)]},
    });
    fireEvent.click(screen.getByTestId("tv-time-import-start"));

    await waitFor(() => expect(screen.getByTestId("tv-time-import-review")).toBeInTheDocument());
    expect(screen.getByText("Mystery Show")).toBeInTheDocument();
    expect(api.runImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("tv-time-import-continue"));

    await waitFor(() => expect(api.upsertMediaMapping).toHaveBeenCalled());
    await waitFor(() => expect(api.runImport).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent("Import completed"),
    );
  });
});
