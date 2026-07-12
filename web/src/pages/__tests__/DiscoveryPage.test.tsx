import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {DiscoveryPage} from "../DiscoveryPage";
import {api} from "../../api/client";
import {movieDetail, tvDetail} from "../../test/fixtures";
import {MediaSummary} from "../../types/media";

vi.mock("../../api/client", () => ({
  api: {
    search: vi.fn(),
    trendingMovies: vi.fn(),
    trendingShows: vi.fn(),
  },
}));

const paged = (results: MediaSummary[]) => ({page: 1, totalPages: 1, totalResults: results.length, results});

describe("DiscoveryPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads TV trending, switches to movies, and opens a media card", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    vi.mocked(api.trendingShows).mockResolvedValue(paged([tvDetail]));
    vi.mocked(api.trendingMovies).mockResolvedValue(paged([movieDetail]));

    render(<DiscoveryPage view="trending" language="en-US" onSelect={onSelect} />);

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

    render(<DiscoveryPage view="search" language="en-US" onSelect={vi.fn()} />);

    expect(screen.getByText("Enter a title to search.")).toBeVisible();
    await user.type(screen.getByTestId("search-input"), "Unknown title{Enter}");

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("Unknown title", "en-US"));
    expect(await screen.findByText("No results found.")).toBeVisible();
  });

  it("renders recoverable API error state", async () => {
    vi.mocked(api.trendingShows).mockRejectedValue(new Error("TMDb unavailable."));

    render(<DiscoveryPage view="trending" language="en-US" onSelect={vi.fn()} />);

    expect(await screen.findByText("TMDb unavailable.")).toBeVisible();
  });
});
