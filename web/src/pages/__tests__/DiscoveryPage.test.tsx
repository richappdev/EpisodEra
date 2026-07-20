import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {ReactElement} from "react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {DiscoveryPage} from "../DiscoveryPage";
import {api} from "../../api/client";
import {buildContinuationGroups} from "../../lib/continuation";
import {movieDetail, progressSummary, tvDetail, watchlistItem} from "../../test/fixtures";
import {MediaSummary} from "../../types/media";

vi.mock("../../api/client", () => ({
  api: {
    search: vi.fn(),
    trendingMovies: vi.fn(),
    trendingShows: vi.fn(),
    discoverSuggestions: vi.fn(),
  },
}));

const paged = (results: MediaSummary[]) => ({page: 1, totalPages: 1, totalResults: results.length, results});

const emptySuggestions = {
  mood: null,
  maxMinutes: null,
  region: "US",
  providerIds: [],
  rails: [],
  moods: [],
  providers: [],
};

const renderDiscovery = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("DiscoveryPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(api.discoverSuggestions).mockResolvedValue(emptySuggestions);
  });

  it("loads TV trending, switches to movies, and opens a media card", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(api.trendingShows).mockResolvedValue(paged([tvDetail]));
    vi.mocked(api.trendingMovies).mockResolvedValue(paged([movieDetail]));

    renderDiscovery(<DiscoveryPage view="trending" language="en-US" onSelect={onSelect} />);

    await expect(screen.findByRole("heading", {name: "Trending TV Shows"})).resolves.toBeVisible();
    expect(screen.getByTestId("media-card-tv-1001")).toHaveTextContent("Critical Flow Show");

    await user.click(screen.getByRole("tab", {name: "Movies"}));
    await expect(screen.findByRole("heading", {name: "Trending Movies"})).resolves.toBeVisible();
    expect(screen.getByTestId("media-card-movie-2001")).toHaveTextContent("Critical Flow Movie");

    await user.click(screen.getByTestId("media-card-movie-2001"));
    expect(onSelect).toHaveBeenCalledWith(movieDetail);
  });

  it("submits search by Enter and renders no-result state", async () => {
    const user = userEvent.setup();
    vi.mocked(api.search).mockResolvedValue({movies: paged([]), tv: paged([])});

    renderDiscovery(<DiscoveryPage view="search" language="en-US" onSelect={vi.fn()} />);

    expect(screen.getByText("Enter a title to search.")).toBeVisible();
    await user.type(screen.getByTestId("search-input"), "Unknown title{Enter}");

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("Unknown title", "en-US", {page: 1}));
    expect(await screen.findByText("No results found.")).toBeVisible();
  });

  it("does not render Continue Watching without continuation props", async () => {
    vi.mocked(api.trendingShows).mockResolvedValue(paged([tvDetail]));

    renderDiscovery(<DiscoveryPage view="trending" language="en-US" onSelect={vi.fn()} />);

    expect(await screen.findByTestId("discovery-smart")).toBeVisible();
    expect(screen.queryByTestId("continue-card-1001")).not.toBeInTheDocument();
    expect(screen.queryByTestId("continue-panel")).not.toBeInTheDocument();
    expect(document.getElementById("continue-watching")).toBeNull();
    expect(screen.queryByRole("heading", {name: "Continue watching"})).not.toBeInTheDocument();
  });

  it("renders a featured Continue Watching card when continuation data is provided", async () => {
    const onSelectContinuation = vi.fn();
    const onNextEpisodeWatched = vi.fn();
    const continueWatching = buildContinuationGroups([watchlistItem], [progressSummary]).continueWatching;
    vi.mocked(api.trendingShows).mockResolvedValue(paged([tvDetail]));

    renderDiscovery(
      <DiscoveryPage
        view="trending"
        language="en-US"
        continueWatching={continueWatching}
        onSelect={vi.fn()}
        onSelectContinuation={onSelectContinuation}
        onNextEpisodeWatched={onNextEpisodeWatched}
      />,
    );

    expect(await screen.findByRole("heading", {name: "Continue watching"})).toBeVisible();
    expect(screen.getByTestId("continue-card-1001")).toBeVisible();
    expect(screen.getByTestId("continue-resume-1001")).toBeVisible();
    expect(screen.getByTestId("continue-see-all")).toHaveAttribute("href", "/watchlist#continue-watching");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("loads mood suggestions and lets the user pick a mood", async () => {
    const user = userEvent.setup();
    vi.mocked(api.trendingShows).mockResolvedValue(paged([tvDetail]));
    vi.mocked(api.discoverSuggestions).mockResolvedValue({
      ...emptySuggestions,
      rails: [{id: "relaxing", title: "Something relaxing", reason: "test", items: [movieDetail]}],
    });

    renderDiscovery(<DiscoveryPage view="trending" language="en-US" onSelect={vi.fn()} />);

    expect(await screen.findByTestId("discovery-smart")).toBeVisible();
    expect(screen.getByTestId("home-franchises-link")).toHaveAttribute("href", "/franchises");
    expect(await screen.findByRole("heading", {name: "Something relaxing"})).toBeVisible();
    expect(screen.getByTestId("media-card-movie-2001")).toBeVisible();
    expect(screen.getByTestId("list-more-relaxing")).toHaveAttribute("href", "/list/relaxing");
    await user.click(screen.getByTestId("mood-relaxing"));
    await waitFor(() =>
      expect(api.discoverSuggestions).toHaveBeenCalledWith(
        "en-US",
        expect.objectContaining({mood: "relaxing"}),
      ),
    );
  });

  it("renders recoverable API error state", async () => {
    vi.mocked(api.trendingShows).mockRejectedValue(new Error("TMDb unavailable."));

    renderDiscovery(<DiscoveryPage view="trending" language="en-US" onSelect={vi.fn()} />);

    expect(await screen.findByText("TMDb unavailable.")).toBeVisible();
  });
});
