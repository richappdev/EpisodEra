import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {now} from "../../test/fixtures";
import {HistoryEntry} from "../../types/history";
import {TimelinePage} from "../TimelinePage";

const entries: HistoryEntry[] = [
  {
    historyId: "tv_1001_s01e01",
    tmdbId: 1001,
    mediaType: "tv",
    title: "Critical Flow Show",
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Pilot",
    watchedAt: "2026-07-14T12:00:00.000Z",
    updatedAt: now,
    rewatchCount: 0,
  },
  {
    historyId: "tv_1001_s01e02",
    tmdbId: 1001,
    mediaType: "tv",
    title: "Critical Flow Show",
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: "The Gap",
    watchedAt: "2026-07-14T18:00:00.000Z",
    updatedAt: now,
    rewatchCount: 2,
  },
  {
    historyId: "movie_2001",
    tmdbId: 2001,
    mediaType: "movie",
    title: "Critical Flow Movie",
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
    watchedAt: "2026-06-01T10:00:00.000Z",
    updatedAt: now,
    rewatchCount: 0,
  },
];

const renderTimeline = (overrides: Partial<Parameters<typeof TimelinePage>[0]> = {}) => {
  const props = {
    error: null,
    hasMore: false,
    items: entries,
    loading: false,
    loadingMore: false,
    signedIn: true,
    totalCount: entries.length,
    onDeleteEntry: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onSelectEntry: vi.fn(),
    onUpdateWatchedAt: vi.fn(),
    ...overrides,
  };

  render(<TimelinePage {...props} />);
  return props;
};

describe("TimelinePage", () => {
  it("groups history and filters by media type and rewatches", async () => {
    const user = userEvent.setup();
    renderTimeline();

    expect(screen.getByTestId("timeline-header")).toHaveTextContent("Timeline");
    expect(screen.getByTestId("timeline-row-tv_1001_s01e01")).toBeVisible();
    expect(screen.getByTestId("timeline-rewatch-tv_1001_s01e02")).toHaveTextContent("Rewatch ×2");

    await user.selectOptions(screen.getByTestId("timeline-media-filter"), "movie");
    expect(screen.queryByTestId("timeline-row-tv_1001_s01e01")).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline-row-movie_2001")).toBeVisible();

    await user.selectOptions(screen.getByTestId("timeline-media-filter"), "all");
    await user.click(screen.getByTestId("timeline-rewatch-filter"));
    expect(screen.getByTestId("timeline-row-tv_1001_s01e02")).toBeVisible();
    expect(screen.queryByTestId("timeline-row-movie_2001")).not.toBeInTheDocument();
  });

  it("searches entries and supports date correction", async () => {
    const user = userEvent.setup();
    const props = renderTimeline();

    await user.type(screen.getByTestId("timeline-search"), "Pilot");
    expect(screen.getByTestId("timeline-row-tv_1001_s01e01")).toBeVisible();
    expect(screen.queryByTestId("timeline-row-movie_2001")).not.toBeInTheDocument();

    await user.clear(screen.getByTestId("timeline-search"));
    await user.click(screen.getByTestId("timeline-edit-tv_1001_s01e01"));
    const input = screen.getByTestId("timeline-edit-input-tv_1001_s01e01");
    await user.clear(input);
    await user.type(input, "2026-07-10T09:30");
    await user.click(screen.getByTestId("timeline-edit-save-tv_1001_s01e01"));

    expect(props.onUpdateWatchedAt).toHaveBeenCalledWith(
      entries[0],
      expect.stringMatching(/^2026-07-10T/),
    );
  });

  it("deletes an entry after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const props = renderTimeline();

    await user.click(screen.getByTestId("timeline-delete-movie_2001"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(props.onDeleteEntry).toHaveBeenCalledWith(entries[2]);
    confirmSpy.mockRestore();
  });

  it("renders signed-out and empty filter states", () => {
    const {rerender} = render(
      <TimelinePage
        error={null}
        hasMore={false}
        items={[]}
        loading={false}
        loadingMore={false}
        signedIn={false}
        totalCount={0}
        onDeleteEntry={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onSelectEntry={vi.fn()}
        onUpdateWatchedAt={vi.fn()}
      />,
    );
    expect(screen.getByText("Sign in to view your personal timeline.")).toBeVisible();

    rerender(
      <TimelinePage
        error={null}
        hasMore={false}
        items={[]}
        loading={false}
        loadingMore={false}
        signedIn
        totalCount={0}
        onDeleteEntry={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        onSelectEntry={vi.fn()}
        onUpdateWatchedAt={vi.fn()}
      />,
    );
    expect(screen.getByText("No timeline entries match these filters.")).toBeVisible();
  });
});
