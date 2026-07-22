import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {useAppContext} from "../../AppContext";
import {LandingPage} from "../LandingPage";
import {tvDetail} from "../../test/fixtures";

vi.mock("../../api/client", () => ({
  api: {
    trendingShows: vi.fn(),
    trendingMovies: vi.fn(),
  },
}));

vi.mock("../../AppContext", () => ({
  useAppContext: vi.fn(),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppContext).mockReturnValue({language: "en-US"} as never);
    vi.mocked(api.trendingShows).mockResolvedValue({
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [{...tvDetail, images: {...tvDetail.images, poster: "https://example.com/p.jpg"}}],
    });
    vi.mocked(api.trendingMovies).mockResolvedValue({
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
  });

  it("renders brand hero copy and loads poster art", async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {level: 1})).toBeVisible();
    await waitFor(() => expect(api.trendingShows).toHaveBeenCalledWith("en-US", {page: 1}));
    expect(screen.getAllByRole("link", {name: "Join Episodera"}).length).toBeGreaterThan(0);
  });
});
