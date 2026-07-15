import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {DetailPage} from "../DetailPage";
import {movieDetail, progress, seasonDetail, tvDetail, watchlistItem} from "../../test/fixtures";

const renderDetail = (overrides: Partial<Parameters<typeof DetailPage>[0]> = {}) => {
  const props = {
    detail: tvDetail,
    onAddToWatchlist: vi.fn(),
    onBack: vi.fn(),
    onEpisodeUnwatched: vi.fn(),
    onEpisodeWatched: vi.fn(),
    onMarkAvailableSeasonWatched: vi.fn(),
    onMarkNextEpisodeWatched: vi.fn(),
    onMarkPreviousEpisodesWatched: vi.fn(),
    onMarkSeasonUnwatched: vi.fn(),
    onMarkSelectedEpisodes: vi.fn(),
    onRemoveFromWatchlist: vi.fn(),
    onSeasonChange: vi.fn(),
    onWatchlistStatusChange: vi.fn(),
    progress,
    progressError: null,
    progressLoading: false,
    seasonDetail,
    seasonError: null,
    seasonLoading: false,
    selectedSeason: 1,
    signedIn: true,
    watchlistItem,
    ...overrides,
  };

  render(<DetailPage {...props} />);
  return props;
};

describe("DetailPage", () => {
  it("renders TV detail fields, watchlist status, progress, and episode controls", () => {
    renderDetail();

    expect(screen.getByTestId("detail-tv-1001")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByText("Returning Series")).toBeVisible();
    expect(screen.getByText("3 episodes")).toBeVisible();
    expect(screen.getByTestId("show-progress-summary")).toHaveTextContent("1 / 3 episodes · 33.33% complete");
    expect(screen.getByTestId("show-progress-summary")).toHaveTextContent("2 episodes remaining");
    expect(screen.getByText("1 of 3 watched (33.33%) · Season 1/3")).toBeVisible();
    expect(screen.getByTestId("detail-watchlist-status")).toHaveValue("watching");
    expect(screen.getByTestId("episode-row-s01e01")).toHaveTextContent("Pilot");
    expect(screen.getByTestId("episode-toggle-s01e01")).toHaveTextContent("Watched");
    expect(screen.getByTestId("episode-toggle-s01e02")).toHaveTextContent("Mark watched");
  });

  it("renders season progress cards with remaining estimates", () => {
    renderDetail();

    expect(screen.getByTestId("season-card-1")).toHaveTextContent("1 / 3 episodes");
    expect(screen.getByTestId("season-card-1")).toHaveTextContent("2 remaining");
    expect(screen.getByTestId("season-remaining-time")).toHaveTextContent("1h 24m left");
  });

  it("nests episode controls inside the selected season card", () => {
    renderDetail();

    const selectedSeason = screen.getByTestId("season-card-1");
    expect(within(selectedSeason).getByTestId("season-episode-panel")).toBeVisible();
    expect(within(selectedSeason).getByTestId("episode-row-s01e01")).toHaveTextContent("Pilot");
    expect(within(selectedSeason).getByTestId("mark-season-watched")).toBeVisible();
  });

  it("toggles season episode panel open and closed from the season card", async () => {
    const user = userEvent.setup();
    renderDetail();

    const seasonCard = screen.getByTestId("season-card-1");
    const toggle = within(seasonCard).getByRole("button", {expanded: true});

    expect(within(seasonCard).getByTestId("season-episode-panel")).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(seasonCard).queryByTestId("season-episode-panel")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(seasonCard).getByTestId("season-episode-panel")).toBeVisible();
  });

  it("calls watchlist and episode callbacks from controls", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.selectOptions(screen.getByTestId("detail-watchlist-status"), "completed");
    expect(props.onWatchlistStatusChange).toHaveBeenCalledWith(watchlistItem, "completed");

    await user.click(screen.getByTestId("detail-remove-watchlist"));
    expect(props.onRemoveFromWatchlist).toHaveBeenCalledWith(watchlistItem);

    await user.click(screen.getByTestId("episode-toggle-s01e01"));
    expect(props.onEpisodeUnwatched).toHaveBeenCalledWith(seasonDetail.episodes[0]);

    await user.click(screen.getByTestId("episode-toggle-s01e02"));
    expect(props.onEpisodeWatched).toHaveBeenCalledWith(seasonDetail.episodes[1]);

    await user.click(screen.getByTestId("mark-season-watched"));
    expect(props.onMarkAvailableSeasonWatched).toHaveBeenCalled();

    await user.click(screen.getByTestId("mark-season-unwatched"));
    expect(props.onMarkSeasonUnwatched).toHaveBeenCalled();
  });

  it("supports multi-select bulk episode actions", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    await user.click(screen.getByTestId("toggle-episode-select"));
    await user.click(screen.getByTestId("episode-select-s01e02"));
    await user.click(screen.getByTestId("mark-selected-watched"));

    expect(props.onMarkSelectedEpisodes).toHaveBeenCalledWith([seasonDetail.episodes[1]], true);
  });

  it("shows a post-completion next-episode prompt", async () => {
    const user = userEvent.setup();
    const props = renderDetail();

    expect(screen.getByTestId("next-episode-prompt")).toHaveTextContent("Next up S1 E2");
    await user.click(screen.getByTestId("next-episode-mark-watched"));
    expect(props.onMarkNextEpisodeWatched).toHaveBeenCalled();

    await user.click(screen.getByTestId("next-episode-dismiss"));
    expect(screen.queryByTestId("next-episode-prompt")).not.toBeInTheDocument();
  });

  it("shows add-to-watchlist control when signed in and not already saved", async () => {
    const user = userEvent.setup();
    const props = renderDetail({progress: null, watchlistItem: null});

    await user.click(screen.getByTestId("detail-add-watchlist"));
    expect(props.onAddToWatchlist).toHaveBeenCalledWith(tvDetail);
  });

  it("blocks episode writes while signed out", () => {
    renderDetail({progress: null, signedIn: false, watchlistItem: null});

    expect(screen.getByText("Sign in to save this title.")).toBeVisible();
    expect(screen.getByText("Sign in to track watched episodes.")).toBeVisible();
    expect(screen.getByTestId("episode-toggle-s01e01")).toBeDisabled();
  });

  it("renders movie details without episode controls", () => {
    renderDetail({
      detail: movieDetail,
      progress: null,
      seasonDetail: null,
      watchlistItem: null,
    });

    expect(screen.getByTestId("detail-movie-2001")).toHaveTextContent("Critical Flow Movie");
    expect(screen.getByTestId("detail-add-watchlist")).toBeVisible();
    expect(screen.queryByText("Episodes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("episode-toggle-s01e01")).not.toBeInTheDocument();
  });

  it("renders progress and season errors independently", () => {
    renderDetail({progressError: "Could not load progress.", seasonError: "Could not load episodes."});

    const panels = screen.getAllByText(/Could not load/);
    expect(within(panels[0].closest(".state-panel") as HTMLElement).getByText("Could not load progress.")).toBeVisible();
    expect(within(panels[1].closest(".state-panel") as HTMLElement).getByText("Could not load episodes.")).toBeVisible();
  });
});
