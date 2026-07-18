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

type FailOnceEndpoint = "watchlist" | "stats" | "history";

interface MockApiOptions {
  autoMarkPreviousEpisodesWatched?: boolean;
  failOnceEndpoints?: FailOnceEndpoint[];
  initialWatchedEpisodes?: number[];
  initialWatchlistStatus?: "planned" | "watching" | "completed" | "dropped";
  state?: MockApiState;
}

interface MockApiStateOptions {
  initialWatchedEpisodes?: number[];
  initialWatchlistStatus?: "planned" | "watching" | "completed" | "dropped";
}

export interface MockApiState {
  abortNextProgressWrite: boolean;
  failNextProgressWrite: boolean;
  failOnceEndpoints: Set<FailOnceEndpoint>;
  progressBatchBodies: EpisodeWriteBody[];
  releaseProgressWrite: (() => void) | null;
  watchlistItem: Record<string, unknown> | null;
  watchedEpisodeNumbers: Set<number>;
}

export const createMockApiState = (options: MockApiStateOptions = {}): MockApiState => ({
  abortNextProgressWrite: false,
  failNextProgressWrite: false,
  failOnceEndpoints: new Set(),
  progressBatchBodies: [],
  releaseProgressWrite: null,
  watchlistItem: options.initialWatchlistStatus ? watchlistItemFor(options.initialWatchlistStatus) : null,
  watchedEpisodeNumbers: new Set(options.initialWatchedEpisodes ?? []),
});

export const installMockApi = async (page: Page, options: MockApiOptions = {}) => {
  const state = options.state ?? createMockApiState({
    initialWatchedEpisodes: options.initialWatchedEpisodes,
    initialWatchlistStatus: options.initialWatchlistStatus,
  });
  state.watchlistItem = options.initialWatchlistStatus
    ? watchlistItemFor(options.initialWatchlistStatus)
    : state.watchlistItem;
  state.watchedEpisodeNumbers =
    options.initialWatchedEpisodes !== undefined ? new Set(options.initialWatchedEpisodes) : state.watchedEpisodeNumbers;
  for (const endpoint of options.failOnceEndpoints ?? []) {
    state.failOnceEndpoints.add(endpoint);
  }

  const currentProgress = () => progressFromWatchedEpisodes([...state.watchedEpisodeNumbers]);
  const currentHistory = () => historyFromWatchedEpisodes([...state.watchedEpisodeNumbers]);

  const consumeFailOnce = (endpoint: FailOnceEndpoint) => {
    if (!state.failOnceEndpoints.has(endpoint)) {
      return false;
    }

    state.failOnceEndpoints.delete(endpoint);
    return true;
  };

  await page.route("**/e2e-api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/e2e-api", "");
    const method = request.method();

    if (method === "GET" && path === "/me/settings") {
      return json(route, {
        autoMarkPreviousEpisodesWatched: options.autoMarkPreviousEpisodesWatched ?? false,
        language: "en-US",
        preferredProviderIds: [],
        watchRegion: "US",
        achievementsEnabled: true,
        showAchievementsOnProfile: true,
        shareActivityWithFriends: false,
        allowFriendRequests: true,
        hideSpoilersUntilWatched: true,
        updatedAt: now,
      });
    }

    if (method === "GET" && path === "/me/profile") {
      return json(route, {
        profile: {
          firstName: "E2E",
          lastName: "User",
          email: "e2e-user@example.com",
          displayName: "E2E User",
          photoURL: null,
          bio: null,
          country: null,
          timezone: null,
          friendCode: "E2E001",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    if (method === "DELETE" && path === "/me/account") {
      return route.fulfill({status: 204, body: ""});
    }

    if (method === "GET" && path === "/watchlist") {
      if (consumeFailOnce("watchlist")) {
        return json(route, {error: {message: "Temporary watchlist outage."}}, 503);
      }

      const items = state.watchlistItem ? [state.watchlistItem] : [];
      return json(route, listPage(items));
    }

    if (method === "GET" && path === "/progress") {
      const progress = currentProgress();
      return json(route, listPage(progress ? [summaryFromProgress(progress)] : []));
    }

    if (method === "GET" && path === "/me/stats") {
      if (consumeFailOnce("stats")) {
        return json(route, {error: {message: "Temporary stats outage."}}, 503);
      }

      return json(route, statsFromState(state.watchlistItem, currentProgress()));
    }

    if (method === "GET" && path === "/me/recap") {
      const year = Number(new URL(request.url()).searchParams.get("year") ?? new Date().getUTCFullYear());
      const stats = statsFromState(state.watchlistItem, currentProgress());
      return json(route, {
        year,
        totalWatchedMovies: stats.totalWatchedMovies,
        totalWatchedEpisodes: stats.totalWatchedEpisodes,
        totalWatchTimeMinutes: stats.totalWatchTimeMinutes,
        longestStreakDays: stats.longestStreakDays,
        mostActiveMonth: stats.mostActiveMonth,
        topShow: stats.topShows[0] ?? null,
        topMovie: stats.topMovies[0] ?? null,
        topGenre: stats.topGenres[0] ?? null,
        newlyDiscovered: stats.topShows.slice(0, 3),
      });
    }

    if (method === "GET" && path === "/me/achievements") {
      return json(route, {
        enabled: true,
        showOnProfile: true,
        unlockedCount: 0,
        items: [],
      });
    }

    if (method === "GET" && path === "/me/friends") {
      return json(route, {
        friendCode: "E2E001",
        allowFriendRequests: true,
        shareActivityWithFriends: false,
        items: [],
      });
    }

    if (method === "GET" && path === "/me/feed") {
      return json(route, {items: []});
    }

    if (method === "GET" && path === "/me/challenges") {
      return json(route, {items: []});
    }

    if (method === "GET" && /^\/discussions\/(movie|tv)\/\d+$/.test(path)) {
      return json(route, {items: []});
    }

    if (method === "POST" && /^\/discussions\/(movie|tv)\/\d+$/.test(path)) {
      const body = request.postDataJSON() as {body?: string};
      return json(
        route,
        {
          commentId: "e2e-comment-1",
          userId: "e2e-user",
          displayName: "E2E",
          body: body.body ?? "",
          mediaType: path.includes("/movie/") ? "movie" : "tv",
          tmdbId: Number(path.split("/").at(-1)),
          seasonNumber: null,
          episodeNumber: null,
          createdAt: new Date().toISOString(),
          spoilerHidden: false,
        },
        201,
      );
    }

    if (method === "GET" && path === "/franchises") {
      return json(route, {
        items: [
          {
            slug: "star-wars",
            name: "Star Wars",
            description: "Skywalker Saga sample",
            titleCount: 2,
            phaseCount: 1,
          },
        ],
      });
    }

    if (method === "GET" && path === "/franchises/star-wars") {
      return json(route, {
        slug: "star-wars",
        name: "Star Wars",
        description: "Skywalker Saga sample",
        phases: [{id: "original", name: "Original"}],
        titles: [
          {
            tmdbId: 11,
            mediaType: "movie",
            title: "A New Hope",
            phaseId: "original",
            releaseOrder: 1,
            chronologicalOrder: 1,
            runtimeMinutes: 121,
            providerIds: [337],
          },
        ],
      });
    }

    if (method === "GET" && path === "/me/franchises/star-wars/progress") {
      return json(route, {
        slug: "star-wars",
        name: "Star Wars",
        description: "Skywalker Saga sample",
        order: "release",
        totalTitles: 1,
        watchedTitles: 0,
        inProgressTitles: 0,
        progressPercent: 0,
        phases: [{id: "original", name: "Original", totalTitles: 1, watchedTitles: 0, progressPercent: 0}],
        titles: [
          {
            tmdbId: 11,
            mediaType: "movie",
            title: "A New Hope",
            phaseId: "original",
            phaseName: "Original",
            releaseOrder: 1,
            chronologicalOrder: 1,
            runtimeMinutes: 121,
            status: "unwatched",
            progressPercent: 0,
          },
        ],
        recommendedNext: {
          tmdbId: 11,
          mediaType: "movie",
          title: "A New Hope",
          phaseId: "original",
          phaseName: "Original",
          releaseOrder: 1,
          chronologicalOrder: 1,
          runtimeMinutes: 121,
          status: "unwatched",
          progressPercent: 0,
        },
      });
    }

    if (method === "GET" && path === "/discover/suggestions") {
      return json(route, {
        mood: null,
        maxMinutes: null,
        region: "US",
        providerIds: [],
        rails: [],
        moods: [
          {id: "relaxing", label: "Something relaxing", genreIds: [35], maxRuntimeMinutes: null},
          {id: "quick-watch", label: "I have 30 minutes", genreIds: [], maxRuntimeMinutes: 30},
        ],
        providers: [{id: 8, name: "Netflix"}],
      });
    }

    if (method === "GET" && path === "/me/history") {
      if (consumeFailOnce("history")) {
        return json(route, {error: {message: "Temporary history outage."}}, 503);
      }

      return json(route, listPage(currentHistory()));
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
      state.watchlistItem = watchlistItemFor("planned");
      return json(route, state.watchlistItem, 201);
    }

    if (method === "PATCH" && path === `/watchlist/tv_${showId}/status`) {
      const body = await request.postDataJSON();
      state.watchlistItem = {...state.watchlistItem, status: body.status, updatedAt: now};
      return json(route, state.watchlistItem);
    }

    if (method === "DELETE" && path === `/watchlist/tv_${showId}`) {
      state.watchlistItem = null;
      return json(route, null, 204);
    }

    if (method === "POST" && path === `/progress/${showId}/episodes/batch`) {
      const body = (await request.postDataJSON()) as EpisodeWriteBody;
      state.progressBatchBodies.push(body);

      if (state.abortNextProgressWrite) {
        state.abortNextProgressWrite = false;
        return route.abort("internetdisconnected");
      }

      if (state.failNextProgressWrite) {
        state.failNextProgressWrite = false;
        return json(route, {error: {message: "Temporary progress outage."}}, 503);
      }

      if (state.releaseProgressWrite) {
        await new Promise<void>((resolve) => {
          state.releaseProgressWrite = resolve;
        });
      }

      for (const item of body.episodes) {
        if (body.watched) {
          state.watchedEpisodeNumbers.add(item.episodeNumber);
        } else {
          state.watchedEpisodeNumbers.delete(item.episodeNumber);
        }
      }

      return json(route, currentProgress());
    }

    if (method === "DELETE" && path.startsWith(`/progress/${showId}/episode/`)) {
      const episodeKey = path.split("/").pop() ?? "";
      const episodeNumber = Number(episodeKey.replace("s01e", ""));
      state.watchedEpisodeNumbers.delete(episodeNumber);
      return json(route, {progress: currentProgress()});
    }

    return json(route, {error: {message: `Unhandled mock route: ${method} ${path}`}}, 500);
  });

  return {
    abortNextProgressWrite: () => {
      state.abortNextProgressWrite = true;
    },
    failNextProgressWrite: () => {
      state.failNextProgressWrite = true;
    },
    holdNextProgressWrite: () => {
      state.releaseProgressWrite = () => undefined;
    },
    releaseProgressWrite: () => {
      state.releaseProgressWrite?.();
      state.releaseProgressWrite = null;
    },
    progressBatchBodies: state.progressBatchBodies,
    state,
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
    poster: showSummary.images.poster,
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
  totalWatchTimeMinutes: Number(progress?.watchedEpisodeCount ?? 0) * 42,
  longestStreakDays: progress ? 1 : 0,
  currentStreakDays: progress ? 1 : 0,
  topShows: progress
    ? [{tmdbId: progress.tmdbId, mediaType: "tv", title: progress.title, count: progress.watchedEpisodeCount}]
    : [],
  topMovies: [],
  topGenres: [],
  mostActiveMonth: progress ? "2026-07" : null,
});

const paged = (results: Array<Record<string, unknown>>) => ({
  page: 1,
  totalPages: 1,
  totalResults: results.length,
  results,
});

const listPage = <T,>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 25,
  totalCount: items.length,
  hasMore: false,
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: status === 204 ? undefined : JSON.stringify(body),
  });
