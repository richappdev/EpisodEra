import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {WatchlistPage} from "../WatchlistPage";
import {progressSummary, watchlistItem} from "../../test/fixtures";

const renderWatchlist = (overrides: Partial<Parameters<typeof WatchlistPage>[0]> = {}) => {
  const props = {
    error: null,
    hasMore: false,
    items: [watchlistItem],
    loading: false,
    loadingMore: false,
    progressItems: [progressSummary],
    signedIn: true,
    totalCount: 1,
    onLoadMore: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onSelectLibrary: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  };

  render(<WatchlistPage {...props} />);
  return props;
};

describe("WatchlistPage", () => {
  it("renders Continue Watching above Active / Library tabs", () => {
    const dormantProgress = {
      ...progressSummary,
      showId: "2002",
      tmdbId: 2002,
      title: "Dormant Show",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const dormantItem = {
      ...watchlistItem,
      itemId: "tv_2002",
      tmdbId: 2002,
      title: "Dormant Show",
    };

    renderWatchlist({
      items: [watchlistItem, dormantItem],
      progressItems: [progressSummary, dormantProgress],
      totalCount: 2,
      onSelectContinuation: vi.fn(),
      onNextEpisodeWatched: vi.fn(),
    });

    expect(screen.getByTestId("watchlist-header")).toHaveTextContent("2 saved");
    expect(screen.getByTestId("continue-card-1001")).toBeVisible();
    expect(screen.getByTestId("continue-next-1001")).toHaveTextContent("S1 · E2 — The Gap");
    expect(screen.getByTestId("continue-panel")).toBeVisible();
    expect(document.getElementById("continue-watching")).not.toBeNull();
    expect(screen.getByRole("heading", {name: "Continue watching"})).toBeVisible();
    expect(screen.queryByTestId("continue-card-2002")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {name: "Haven't watched for a while"})).not.toBeInTheDocument();
    expect(screen.getByTestId("watchlist-item-1001")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("watchlist-tab-active")).toHaveAttribute("aria-selected", "true");
  });

  it("moves dormant and planned titles into the Library tab", async () => {
    const user = userEvent.setup();
    const dormantProgress = {
      ...progressSummary,
      showId: "2002",
      tmdbId: 2002,
      title: "Dormant Show",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const dormantItem = {
      ...watchlistItem,
      itemId: "tv_2002",
      tmdbId: 2002,
      title: "Dormant Show",
    };
    const plannedItem = {
      ...watchlistItem,
      itemId: "tv_3003",
      tmdbId: 3003,
      title: "Planned Show",
      status: "planned" as const,
    };
    const completedItem = {
      ...watchlistItem,
      itemId: "tv_4004",
      tmdbId: 4004,
      title: "Finished Show",
      status: "completed" as const,
    };

    renderWatchlist({
      items: [watchlistItem, dormantItem, plannedItem, completedItem],
      progressItems: [progressSummary, dormantProgress],
      totalCount: 4,
    });

    expect(screen.getByTestId("watchlist-item-1001")).toBeVisible();
    expect(screen.queryByTestId("watchlist-item-2002")).not.toBeInTheDocument();
    expect(screen.queryByTestId("watchlist-item-3003")).not.toBeInTheDocument();
    expect(screen.queryByTestId("watchlist-item-4004")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("watchlist-tab-library"));

    expect(screen.getByTestId("library-item-2002")).toHaveTextContent("Stale");
    expect(screen.getByTestId("library-item-3003")).toHaveTextContent("Planned");
    expect(screen.getByTestId("library-item-4004")).toHaveTextContent("Completed");
  });

  it("hides completed and dropped titles from the active grid", () => {
    const completedItem = {
      ...watchlistItem,
      itemId: "tv_3003",
      tmdbId: 3003,
      title: "Finished Show",
      status: "completed" as const,
    };
    const droppedItem = {
      ...watchlistItem,
      itemId: "tv_4004",
      tmdbId: 4004,
      title: "Dropped Show",
      status: "dropped" as const,
    };

    renderWatchlist({
      items: [watchlistItem, completedItem, droppedItem],
      totalCount: 3,
    });

    expect(screen.getByTestId("watchlist-item-1001")).toBeVisible();
    expect(screen.queryByTestId("watchlist-item-3003")).not.toBeInTheDocument();
    expect(screen.queryByTestId("watchlist-item-4004")).not.toBeInTheDocument();
    expect(screen.getByTestId("watchlist-header")).toHaveTextContent("3 saved");
  });

  it("calls control callbacks for status, remove, select, retry, and load more", async () => {
    const user = userEvent.setup();
    const props = renderWatchlist({hasMore: true});

    await user.selectOptions(screen.getByTestId("watchlist-status-1001"), "completed");
    expect(props.onStatusChange).toHaveBeenCalledWith(watchlistItem, "completed");

    await user.click(screen.getByRole("button", {name: "Critical Flow Show"}));
    expect(props.onSelect).toHaveBeenCalledWith(watchlistItem);

    await user.click(screen.getByRole("button", {name: "Remove Critical Flow Show"}));
    expect(props.onRemove).toHaveBeenCalledWith(watchlistItem);

    await user.click(screen.getByRole("button", {name: "Load more titles"}));
    expect(props.onLoadMore).toHaveBeenCalled();
  });

  it("opens library entries from the Library tab", async () => {
    const user = userEvent.setup();
    const completedItem = {
      ...watchlistItem,
      itemId: "tv_3003",
      tmdbId: 3003,
      title: "Finished Show",
      status: "completed" as const,
    };
    const props = renderWatchlist({
      items: [watchlistItem, completedItem],
      totalCount: 2,
    });

    await user.click(screen.getByTestId("watchlist-tab-library"));
    await user.click(screen.getByRole("button", {name: "Finished Show"}));
    expect(props.onSelectLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        tmdbId: 3003,
        reason: "completed",
        watchlistItem: completedItem,
      }),
    );
  });

  it("renders signed-out, loading, empty, and error states", () => {
    const {rerender} = render(
      <WatchlistPage
        error={null}
        hasMore={false}
        items={[]}
        loading={false}
        loadingMore={false}
        progressItems={[]}
        signedIn={false}
        totalCount={0}
        onLoadMore={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
        onSelectLibrary={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Sign in to manage your watchlist.")).toBeVisible();

    rerender(
      <WatchlistPage
        error={null}
        hasMore={false}
        items={[]}
        loading
        loadingMore={false}
        progressItems={[]}
        signedIn
        totalCount={0}
        onLoadMore={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
        onSelectLibrary={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Loading watchlist...")).toBeVisible();

    rerender(
      <WatchlistPage
        error={null}
        hasMore={false}
        items={[]}
        loading={false}
        loadingMore={false}
        progressItems={[]}
        signedIn
        totalCount={0}
        onLoadMore={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
        onSelectLibrary={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Your watchlist is empty.")).toBeVisible();

    rerender(
      <WatchlistPage
        error="Could not load watchlist."
        hasMore={false}
        items={[]}
        loading={false}
        loadingMore={false}
        progressItems={[]}
        signedIn
        totalCount={0}
        onLoadMore={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
        onSelectLibrary={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Could not load watchlist.")).toBeVisible();
  });

  it("retries watchlist loading from the section error", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWatchlist({error: "Could not load watchlist.", items: [], onRetry});

    await user.click(screen.getByRole("button", {name: "Retry"}));
    expect(onRetry).toHaveBeenCalled();
  });
});
