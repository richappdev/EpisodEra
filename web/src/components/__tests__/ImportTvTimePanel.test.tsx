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

  const openReview = async () => {
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
          reason: "low_confidence",
          confidence: 0.4,
          notes: null,
          candidates: [
            {
              tmdbId: 111,
              title: "Mystery Show",
              poster: null,
              backdrop: null,
              year: "2020",
            },
          ],
        },
      ],
    });
    vi.mocked(api.runImport).mockResolvedValue({
      import: {
        ...baseJob,
        status: "completed",
        watchlistImported: 1,
        episodesImported: 2,
        episodesStaged: 2,
      },
      processedEpisodes: 2,
      remainingEpisodes: 0,
      done: true,
    });

    render(<ImportTvTimePanel language="en-US" signedIn />);
    fireEvent.change(screen.getByTestId("tv-time-zip-input"), {
      target: {files: [makeZipFile(true)]},
    });
    fireEvent.click(screen.getByTestId("tv-time-import-start"));
    await waitFor(() => expect(screen.getByTestId("tv-time-import-review")).toBeInTheDocument());
  };

  it("skips unmatched shows from review and continues import", async () => {
    await openReview();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Skip"));
    fireEvent.click(screen.getByTestId("tv-time-import-continue"));

    await waitFor(() => expect(api.runImport).toHaveBeenCalled());
    expect(api.upsertMediaMapping).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent("1 shows skipped"),
    );
    expect(screen.getByTestId("tv-time-import-skipped")).toHaveTextContent("Skipped shows: Mystery Show");
  });

  it("applies a manual TMDb id and persists the mapping", async () => {
    vi.mocked(api.detail).mockResolvedValue({
      id: 333,
      mediaType: "tv",
      title: "Manual Match",
      overview: "",
      releaseDate: "2021-05-01",
      voteAverage: 7,
      popularity: 1,
      images: {poster: null, backdrop: null},
      genres: [],
      runtimeMinutes: null,
      status: null,
      originalLanguage: null,
      homepage: null,
    });

    await openReview();
    fireEvent.change(screen.getByTestId("tv-time-manual-id-200"), {target: {value: "333"}});
    fireEvent.click(screen.getByTestId("tv-time-apply-manual-200"));

    await waitFor(() => expect(api.detail).toHaveBeenCalledWith("tv", 333, "en-US"));
    await waitFor(() => expect(screen.getByText(/Manual Match \(2021\) · #333/)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("tv-time-import-continue"));
    await waitFor(() =>
      expect(api.upsertMediaMapping).toHaveBeenCalledWith({
        provider: "tv_time",
        mediaType: "tv",
        externalId: "200",
        tmdbId: 333,
        title: "Manual Match",
      }),
    );
  });

  it("shows an error when the manual TMDb id is invalid or missing", async () => {
    await openReview();
    fireEvent.change(screen.getByTestId("tv-time-manual-id-200"), {target: {value: "not-a-number"}});
    fireEvent.click(screen.getByTestId("tv-time-apply-manual-200"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enter a positive TMDb id."));

    fireEvent.change(screen.getByTestId("tv-time-manual-id-200"), {target: {value: "404"}});
    vi.mocked(api.detail).mockRejectedValueOnce(new Error("not found"));
    fireEvent.click(screen.getByTestId("tv-time-apply-manual-200"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not load that TMDb TV id."),
    );
  });

  it("cancels mapping review without starting import", async () => {
    await openReview();
    fireEvent.click(screen.getByTestId("tv-time-import-cancel-review"));
    await waitFor(() => expect(screen.queryByTestId("tv-time-import-review")).not.toBeInTheDocument());
    expect(api.runImport).not.toHaveBeenCalled();
    expect(screen.getByTestId("tv-time-import-start")).toBeEnabled();
  });

  it("continues import when mapping persistence fails", async () => {
    vi.mocked(api.upsertMediaMapping).mockRejectedValueOnce(new Error("save failed"));
    await openReview();
    fireEvent.click(screen.getByTestId("tv-time-import-continue"));
    await waitFor(() => expect(api.runImport).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("tv-time-import-message")).toHaveTextContent("Import completed"),
    );
  });

  it("lets the user pick a different candidate before continuing", async () => {
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
              year: null,
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

    fireEvent.click(screen.getByLabelText(/Mystery Shows · #222/));
    fireEvent.click(screen.getByTestId("tv-time-import-continue"));

    await waitFor(() =>
      expect(api.upsertMediaMapping).toHaveBeenCalledWith(
        expect.objectContaining({externalId: "200", tmdbId: 222, title: "Mystery Shows"}),
      ),
    );
  });
});
