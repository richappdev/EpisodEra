import {expect, test, type Page, type Route} from "@playwright/test";

const showId = 1001;
const now = "2026-07-12T00:00:00.000Z";

const showSummary = {
  id: showId,
  mediaType: "tv",
  title: "Critical Flow Show",
  overview: "A deterministic TV fixture for the signed-in critical path.",
  releaseDate: "2024-01-01",
  voteAverage: 8.4,
  popularity: 42,
  images: {poster: null, backdrop: null},
};

const showDetail = {
  ...showSummary,
  genres: [{id: 18, name: "Drama"}],
  homepage: "https://example.com/critical-flow-show",
  originalLanguage: "en",
  runtimeMinutes: null,
  seasons: [{id: 501, seasonNumber: 1, title: "Season 1", episodeCount: 3, airDate: "2024-01-01", poster: null}],
  status: "Returning Series",
  totalEpisodes: 3,
};

const seasonOne = {
  id: 501,
  tvId: showId,
  seasonNumber: 1,
  title: "Season 1",
  overview: "Season fixture.",
  airDate: "2024-01-01",
  poster: null,
  episodeCount: 3,
  episodes: [
    episode(1, "Pilot"),
    episode(2, "The Gap"),
    episode(3, "Next Step"),
  ],
};

test("signed-in user can complete the core watchlist and episode progress flow", async ({page}) => {
  const requests = await installMockApi(page);

  await page.goto("/");
  await expect(page.getByText("e2e-user@example.com")).toBeVisible();

  await page.getByTestId("nav-search").click();
  await page.getByTestId("search-input").fill("Critical Flow Show");
  await page.getByTestId("search-submit").click();
  await page.getByTestId(`media-card-tv-${showId}`).click();

  await expect(page.getByTestId(`detail-tv-${showId}`)).toBeVisible();
  await expect(page.getByRole("heading", {name: "Critical Flow Show"})).toBeVisible();

  await page.getByTestId("detail-add-watchlist").click();
  await expect(page.getByText("In watchlist")).toBeVisible();

  await page.getByTestId("detail-watchlist-status").selectOption("watching");
  await expect(page.getByTestId("detail-watchlist-status")).toHaveValue("watching");

  await page.getByTestId("episode-toggle-s01e01").click();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Watched");
  await expect(page.getByText("1 of 3 watched")).toBeVisible();

  expect(requests.progressBatchBodies).toEqual([
    {watched: true, episodes: [{seasonNumber: 1, episodeNumber: 1}]},
  ]);
  expect(Object.keys(requests.progressBatchBodies[0].episodes[0]).sort()).toEqual(["episodeNumber", "seasonNumber"]);

  await page.getByTestId("nav-watchlist").click();
  await expect(page.getByTestId(`watchlist-item-${showId}`)).toContainText("Critical Flow Show");
  await expect(page.getByTestId(`continue-card-${showId}`)).toContainText("1 of 3 watched");
  await expect(page.getByTestId(`continue-next-${showId}`)).toHaveText("Next up S1 E2");

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("1");
  await expect(page.getByTestId("stat-currently-watching")).toHaveText("1");
  await expect(page.getByTestId("stat-watchlist-count")).toHaveText("1");
  await expect(page.getByTestId("history-row-tv_1001_s01e01")).toContainText("Pilot");

  await page.getByTestId("nav-watchlist").click();
  await page.getByTestId(`watchlist-item-${showId}`).getByRole("button", {name: "Critical Flow Show", exact: true}).click();
  await page.getByTestId("episode-toggle-s01e01").click();
  await expect(page.getByTestId("episode-toggle-s01e01")).toContainText("Mark watched");
  await expect(page.getByText("No watched episodes yet.")).toBeVisible();

  await page.getByTestId("nav-profile").click();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveText("0");
  await expect(page.getByText("Watched movies and episodes will appear here.")).toBeVisible();

  await page.getByTestId("account-button").click();
  await expect(page.getByTestId("account-button")).toContainText("Sign in");
  await expect(page.getByText("e2e-user@example.com")).toHaveCount(0);
  await expect(page.getByRole("heading", {name: "Trending TV Shows"})).toBeVisible();
  await expect(page.getByTestId("stat-watched-episodes")).toHaveCount(0);
});

const installMockApi = async (page: Page) => {
  let watchlistItem: Record<string, unknown> | null = null;
  let progress: Record<string, unknown> | null = null;
  let history: Array<Record<string, unknown>> = [];
  const progressBatchBodies: Array<{watched: boolean; episodes: Array<{seasonNumber: number; episodeNumber: number}>}> = [];

  await page.route("**/e2e-api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/e2e-api", "");
    const method = request.method();

    if (method === "GET" && path === "/me/settings") {
      return json(route, {autoMarkPreviousEpisodesWatched: false, language: "en-US", updatedAt: now});
    }

    if (method === "GET" && path === "/watchlist") {
      return json(route, {items: watchlistItem ? [watchlistItem] : []});
    }

    if (method === "GET" && path === "/progress") {
      return json(route, {items: progress ? [summaryFromProgress(progress)] : []});
    }

    if (method === "GET" && path === "/me/stats") {
      return json(route, statsFromState(watchlistItem, progress));
    }

    if (method === "GET" && path === "/me/history") {
      return json(route, {items: history});
    }

    if (method === "GET" && path === "/trending/tv") {
      return json(route, paged([showSummary]));
    }

    if (method === "GET" && path === "/trending/movie") {
      return json(route, paged([]));
    }

    if (method === "GET" && path === "/search") {
      return json(route, {movies: paged([]), tv: paged([showSummary])});
    }

    if (method === "GET" && path === `/tv/${showId}`) {
      return json(route, showDetail);
    }

    if (method === "GET" && path === `/tv/${showId}/season/1`) {
      return json(route, seasonOne);
    }

    if (method === "GET" && path === `/progress/${showId}`) {
      return json(route, {progress});
    }

    if (method === "POST" && path === "/watchlist") {
      watchlistItem = {
        addedAt: now,
        backdrop: null,
        itemId: `tv_${showId}`,
        mediaType: "tv",
        poster: null,
        status: "planned",
        title: showSummary.title,
        tmdbId: showId,
        updatedAt: now,
      };
      return json(route, watchlistItem, 201);
    }

    if (method === "PATCH" && path === `/watchlist/tv_${showId}/status`) {
      const body = await request.postDataJSON();
      watchlistItem = {...watchlistItem, status: body.status, updatedAt: now};
      return json(route, watchlistItem);
    }

    if (method === "POST" && path === `/progress/${showId}/episodes/batch`) {
      const body = await request.postDataJSON();
      progressBatchBodies.push(body);
      progress = watchedProgress();
      history = [historyEntry()];
      return json(route, progress);
    }

    if (method === "DELETE" && path === `/progress/${showId}/episode/s01e01`) {
      progress = null;
      history = [];
      return json(route, {progress});
    }

    return json(route, {error: {message: `Unhandled mock route: ${method} ${path}`}}, 500);
  });

  return {progressBatchBodies};
};

function episode(episodeNumber: number, title: string) {
  return {
  id: 5000 + episodeNumber,
  airDate: "2024-01-01",
  episodeKey: `s01e0${episodeNumber}`,
  episodeNumber,
  overview: `${title} overview.`,
  runtimeMinutes: null,
  seasonNumber: 1,
  still: null,
  title,
  voteAverage: 8,
  };
}

const watchedProgress = () => ({
  showId: String(showId),
  tmdbId: showId,
  title: showSummary.title,
  totalEpisodes: 3,
  watchedEpisodeCount: 1,
  progressPercent: 33.33,
  currentSeason: 1,
  currentEpisode: 1,
  nextEpisode: {episodeKey: "s01e02", seasonNumber: 1, episodeNumber: 2, episodeTitle: "The Gap"},
  updatedAt: now,
  episodes: [
    {
      episodeKey: "s01e01",
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: "Pilot",
      watched: true,
      watchedAt: now,
      updatedAt: now,
    },
  ],
});

const historyEntry = () => ({
  historyId: "tv_1001_s01e01",
  tmdbId: showId,
  mediaType: "tv",
  title: showSummary.title,
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  watchedAt: now,
  updatedAt: now,
});

const summaryFromProgress = (item: Record<string, unknown>) => {
  const {episodes: _episodes, ...summary} = item;
  return summary;
};

const statsFromState = (watchlistItem: Record<string, unknown> | null, progress: Record<string, unknown> | null) => ({
  totalWatchedMovies: 0,
  totalWatchedEpisodes: progress ? 1 : 0,
  currentlyWatchingCount: watchlistItem?.status === "watching" ? 1 : 0,
  completedShowsCount: watchlistItem?.status === "completed" ? 1 : 0,
  watchlistCount: watchlistItem ? 1 : 0,
  progressShowCount: progress ? 1 : 0,
});

const paged = (results: Array<Record<string, unknown>>) => ({
  page: 1,
  totalPages: 1,
  totalResults: results.length,
  results,
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
