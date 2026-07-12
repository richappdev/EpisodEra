import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {WatchlistPage} from "../WatchlistPage";
import {progressSummary, watchlistItem} from "../../test/fixtures";

const renderWatchlist = (overrides: Partial<Parameters<typeof WatchlistPage>[0]> = {}) => {
  const props = {
    error: null,
    items: [watchlistItem],
    loading: false,
    progressItems: [progressSummary],
    signedIn: true,
    onNextEpisodeWatched: vi.fn(),
    onRemove: vi.fn(),
    onSelect: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  };

  render(<WatchlistPage {...props} />);
  return props;
};

describe("WatchlistPage", () => {
  it("renders saved titles, Continue Watching progress, and next episode", () => {
    renderWatchlist();

    expect(screen.getByTestId("watchlist-header")).toHaveTextContent("1 saved");
    expect(screen.getByTestId("watchlist-item-1001")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("continue-card-1001")).toHaveTextContent("1 of 3 watched");
    expect(screen.getByTestId("continue-next-1001")).toHaveTextContent("Next up S1 E2");
  });

  it("calls control callbacks for status, next episode, remove, and select", async () => {
    const user = userEvent.setup();
    const props = renderWatchlist();

    await user.selectOptions(screen.getByTestId("watchlist-status-1001"), "completed");
    expect(props.onStatusChange).toHaveBeenCalledWith(watchlistItem, "completed");

    await user.click(screen.getByTestId("continue-watched-1001"));
    expect(props.onNextEpisodeWatched).toHaveBeenCalledWith(watchlistItem, progressSummary);

    await user.click(screen.getByRole("button", {name: "Critical Flow Show"}));
    expect(props.onSelect).toHaveBeenCalledWith(watchlistItem);

    await user.click(screen.getByRole("button", {name: "Remove Critical Flow Show"}));
    expect(props.onRemove).toHaveBeenCalledWith(watchlistItem);
  });

  it("renders signed-out, loading, empty, and error states", () => {
    const {rerender} = render(
      <WatchlistPage
        error={null}
        items={[]}
        loading={false}
        progressItems={[]}
        signedIn={false}
        onNextEpisodeWatched={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Sign in to manage your watchlist.")).toBeVisible();

    rerender(
      <WatchlistPage
        error={null}
        items={[]}
        loading
        progressItems={[]}
        signedIn
        onNextEpisodeWatched={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Loading watchlist...")).toBeVisible();

    rerender(
      <WatchlistPage
        error={null}
        items={[]}
        loading={false}
        progressItems={[]}
        signedIn
        onNextEpisodeWatched={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Your watchlist is empty.")).toBeVisible();

    rerender(
      <WatchlistPage
        error="Could not load watchlist."
        items={[]}
        loading={false}
        progressItems={[]}
        signedIn
        onNextEpisodeWatched={vi.fn()}
        onRemove={vi.fn()}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Could not load watchlist.")).toBeVisible();
  });
});
