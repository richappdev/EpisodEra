import assert from "node:assert/strict";
import test from "node:test";
import {EXPORT_SCHEMA_VERSION} from "../models/export";
import {HistoryEntry} from "../models/history";
import {ShowProgress, ShowProgressSummary} from "../models/progress";
import {WatchlistItem} from "../models/watchlist";
import {exportService} from "./exportService";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

const historyEntry: HistoryEntry = {
  historyId: "tv_95396_s01e01",
  tmdbId: 95396,
  mediaType: "tv",
  title: "Severance",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Good News About Hell",
  watchedAt: "2026-07-10T07:00:00.000Z",
  updatedAt: "2026-07-10T07:00:00.000Z",
  rewatchCount: 0,
  genreNames: ["Drama"],
  runtimeMinutes: 57,
};

const progressSummary: ShowProgressSummary = {
  showId: "95396",
  tmdbId: 95396,
  title: "Severance",
  poster: null,
  totalEpisodes: 10,
  watchedEpisodeCount: 1,
  progressPercent: 10,
  currentSeason: 1,
  currentEpisode: 1,
  nextEpisode: {
    episodeKey: "s01e02",
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: "Half Loop",
  },
  updatedAt: "2026-07-10T07:00:00.000Z",
};

const progressDetail: ShowProgress = {
  ...progressSummary,
  episodes: [
    {
      episodeKey: "s01e01",
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: "Good News About Hell",
      watched: true,
      watchedAt: "2026-07-10T07:00:00.000Z",
      updatedAt: "2026-07-10T07:00:00.000Z",
    },
  ],
};

const watchlistItem: WatchlistItem = {
  itemId: "tv_95396",
  tmdbId: 95396,
  mediaType: "tv",
  title: "Severance",
  poster: "/poster.jpg",
  backdrop: "/backdrop.jpg",
  status: "watching",
  addedAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-10T07:00:00.000Z",
};

test("exportService.build assembles history, progress with episodes, and watchlist", async () => {
  const originalHistoryList = historyService.list;
  const originalProgressList = progressService.list;
  const originalProgressGet = progressService.get;
  const originalWatchlistList = watchlistService.list;

  historyService.list = (async () => ({
    items: [historyEntry],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof historyService.list;

  progressService.list = (async () => ({
    items: [progressSummary],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof progressService.list;

  progressService.get = (async () => progressDetail) as typeof progressService.get;

  watchlistService.list = (async () => ({
    items: [watchlistItem],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof watchlistService.list;

  try {
    const exportPayload = await exportService.build("user-1");

    assert.equal(exportPayload.manifest.schemaVersion, EXPORT_SCHEMA_VERSION);
    assert.equal(exportPayload.manifest.userId, "user-1");
    assert.equal(exportPayload.manifest.counts.history, 1);
    assert.equal(exportPayload.manifest.counts.progressShows, 1);
    assert.equal(exportPayload.manifest.counts.progressEpisodes, 1);
    assert.equal(exportPayload.manifest.counts.watchlist, 1);
    assert.ok(Date.parse(exportPayload.manifest.exportedAt));
    assert.deepEqual(exportPayload.history, [historyEntry]);
    assert.deepEqual(exportPayload.progress, [progressDetail]);
    assert.deepEqual(exportPayload.watchlist, [watchlistItem]);
  } finally {
    historyService.list = originalHistoryList;
    progressService.list = originalProgressList;
    progressService.get = originalProgressGet;
    watchlistService.list = originalWatchlistList;
  }
});

test("exportService.build skips missing progress details", async () => {
  const originalHistoryList = historyService.list;
  const originalProgressList = progressService.list;
  const originalProgressGet = progressService.get;
  const originalWatchlistList = watchlistService.list;

  historyService.list = (async () => ({
    items: [],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof historyService.list;

  progressService.list = (async () => ({
    items: [progressSummary],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof progressService.list;

  progressService.get = (async () => null) as typeof progressService.get;

  watchlistService.list = (async () => ({
    items: [],
    pageSize: 100,
    nextPageToken: null,
    hasMore: false,
  })) as typeof watchlistService.list;

  try {
    const exportPayload = await exportService.build("user-2");
    assert.equal(exportPayload.manifest.counts.progressShows, 0);
    assert.deepEqual(exportPayload.progress, []);
  } finally {
    historyService.list = originalHistoryList;
    progressService.list = originalProgressList;
    progressService.get = originalProgressGet;
    watchlistService.list = originalWatchlistList;
  }
});
