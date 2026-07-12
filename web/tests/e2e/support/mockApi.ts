import {type Page, type Route} from "@playwright/test";

export const showId = 1001;
export const now = "2026-07-12T00:00:00.000Z";

export const showSummary = {
  id: showId,
  mediaType: "tv",
  title: "Critical Flow Show",
  overview: "A deterministic TV fixture for the signed-in critical path.",
  releaseDate: "2024-01-01",
  voteAverage: 8.4,
  popularity: 42,
  images: {poster: null, backdrop: null},
};

export const showDetail = {
  ...showSummary,
  genres: [{id: 18, name: "Drama"}],
  homepage: "https://example.com/critical-flow-show",
  originalLanguage: "en",
  runtimeMinutes: null,
  seasons: [{id: 501, seasonNumber: 1, title: "Season 1", episodeCount: 3, airDate: "2024-01-01", poster: null}],
  status: "Returning Series",
  totalEpisodes: 3,
};

export const seasonOne = {
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

type EpisodeWriteBody = {
  watched: boolean;
  episodes: Array<{seasonNumber: number; episodeNumber: number}>;
};

interface MockApiOptions {
  autoMarkPreviousEpisodesWatched?: boolean;
  initialWatchedEpisodes?: number[];
  initialWatchlistStatus?: "planned" | "watching" | "completed" | "dropped";
}

export const installMockApi = async (page: Page, options: MockApiOptions = {}) => {
  let watchlistItem: Record<string, unknown> | null = options.initialWatchlistStatus
    ? watchlistItemFor(options.initialWatchlistStatus)
    : null;
  let watchedEpisodeNumbers = new Set(options.initialWatchedEpisodes ?? []);
  let failNextProgressWrite = false;
  const progressBatchBodies: EpisodeWriteBody[] = [];

  const currentProgress = () => progressFromWatchedEpisodes([...watchedEpisodeNumbers]);
  const currentHistory = () => historyFromWatchedEpisodes([...watchedEpisodeNumbers]);

  await page.route("**/e2e-api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/e2e-api", "");
    const method = request.method();

    if (method === "GET" && path === "/me/settings") {
      return json(route, {
        autoMarkPreviousEpisodesWatched: options.autoMarkPreviousEpisodesWatched ?? false,
        language: "en-US",
        updatedAt: now,
      });
    }

    if (method === "GET" && path === "/watchlist") {
      return json(route, {items: watchlistItem ? [watchlistItem] : []});
    }

    if (method === "GET" && path === "/progress") {
      const progress = currentProgress();
      return json(route, {items: progress ? [summaryFromProgress(progress)] : []});
    }

    if (method === "GET" && path === "/me/stats") {
      return json(route, statsFromState(watchlistItem, currentProgress()));
    }

    if (method === "GET" && path === "/me/history") {
      return json(route, {items: currentHistory()});
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
      return json(route, {progress: currentProgress()});
    }

    if (method === "POST" && path === "/watchlist") {
      watchlistItem = watchlistItemFor("planned");
      return json(route, watchlistItem, 201);
    }

    if (method === "PATCH" && path === `/watchlist/tv_${showId}/status`) {
      const body = await request.postDataJSON();
      watchlistItem = {...watchlistItem, status: body.status, updatedAt: now};
      return json(route, watchlistItem);
    }

    if (method === "DELETE" && path === `/watchlist/tv_${showId}`) {
      watchlistItem = null;
      return json(route, null, 204);
    }

    if (method === "POST" && path === `/progress/${showId}/episodes/batch`) {
      const body = (await request.postDataJSON()) as EpisodeWriteBody;
      progressBatchBodies.push(body);

      if (failNextProgressWrite) {
        failNextProgressWrite = false;
        return json(route, {error: {message: "Temporary progress outage."}}, 503);
      }

      for (const item of body.episodes) {
        if (body.watched) {
          watchedEpisodeNumbers.add(item.episodeNumber);
        } else {
          watchedEpisodeNumbers.delete(item.episodeNumber);
        }
      }

      return json(route, currentProgress());
    }

    if (method === "DELETE" && path.startsWith(`/progress/${showId}/episode/`)) {
      const episodeKey = path.split("/").pop() ?? "";
      const episodeNumber = Number(episodeKey.replace("s01e", ""));
      watchedEpisodeNumbers.delete(episodeNumber);
      return json(route, {progress: currentProgress()});
    }

    return json(route, {error: {message: `Unhandled mock route: ${method} ${path}`}}, 500);
  });

  return {
    failNextProgressWrite: () => {
      failNextProgressWrite = true;
    },
    progressBatchBodies,
  };
};

export const openShowDetailFromSearch = async (page: Page) => {
  await page.getByTestId("nav-search").click();
  await page.getByTestId("search-input").fill(showSummary.title);
  await page.getByTestId("search-submit").click();
  await page.getByTestId(`media-card-tv-${showId}`).click();
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

const watchlistItemFor = (status: "planned" | "watching" | "completed" | "dropped") => ({
  addedAt: now,
  backdrop: null,
  itemId: `tv_${showId}`,
  mediaType: "tv",
  poster: null,
  status,
  title: showSummary.title,
  tmdbId: showId,
  updatedAt: now,
});

const progressFromWatchedEpisodes = (watchedEpisodeNumbers: number[]) => {
  const watched = watchedEpisodeNumbers.sort((left, right) => left - right);

  if (watched.length === 0) {
    return null;
  }

  const watchedSet = new Set(watched);
  const nextEpisode = seasonOne.episodes.find((candidate) => !watchedSet.has(candidate.episodeNumber));
  const latestEpisode = seasonOne.episodes.findLast((candidate) => watchedSet.has(candidate.episodeNumber));

  return {
    showId: String(showId),
    tmdbId: showId,
    title: showSummary.title,
    totalEpisodes: seasonOne.episodeCount,
    watchedEpisodeCount: watched.length,
    progressPercent: Number(((watched.length / seasonOne.episodeCount) * 100).toFixed(2)),
    currentSeason: latestEpisode?.seasonNumber ?? null,
    currentEpisode: latestEpisode?.episodeNumber ?? null,
    nextEpisode: nextEpisode
      ? {
          episodeKey: nextEpisode.episodeKey,
          seasonNumber: nextEpisode.seasonNumber,
          episodeNumber: nextEpisode.episodeNumber,
          episodeTitle: nextEpisode.title,
        }
      : null,
    updatedAt: now,
    episodes: watched.map((episodeNumber) => {
      const watchedEpisode = seasonOne.episodes[episodeNumber - 1];
      return {
        episodeKey: watchedEpisode.episodeKey,
        seasonNumber: watchedEpisode.seasonNumber,
        episodeNumber: watchedEpisode.episodeNumber,
        episodeTitle: watchedEpisode.title,
        watched: true,
        watchedAt: now,
        updatedAt: now,
      };
    }),
  };
};

const historyFromWatchedEpisodes = (watchedEpisodeNumbers: number[]) =>
  watchedEpisodeNumbers.sort((left, right) => right - left).map((episodeNumber) => {
    const watchedEpisode = seasonOne.episodes[episodeNumber - 1];
    return {
      historyId: `tv_1001_s01e0${episodeNumber}`,
      tmdbId: showId,
      mediaType: "tv",
      title: showSummary.title,
      seasonNumber: watchedEpisode.seasonNumber,
      episodeNumber: watchedEpisode.episodeNumber,
      episodeTitle: watchedEpisode.title,
      watchedAt: now,
      updatedAt: now,
    };
  });

const summaryFromProgress = (item: Record<string, unknown>) => {
  const {episodes: _episodes, ...summary} = item;
  return summary;
};

const statsFromState = (watchlistItem: Record<string, unknown> | null, progress: Record<string, unknown> | null) => ({
  totalWatchedMovies: 0,
  totalWatchedEpisodes: progress?.watchedEpisodeCount ?? 0,
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
    body: status === 204 ? undefined : JSON.stringify(body),
  });
