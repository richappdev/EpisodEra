import {describe, expect, it} from "vitest";
import {progressSummary, watchlistItem} from "../test/fixtures";
import {
  buildContinuationGroups,
  DORMANT_AFTER_DAYS,
  optimisticMarkNextEpisode,
  suggestedWatchlistStatusForProgress,
} from "./continuation";

const now = new Date("2026-07-15T00:00:00.000Z");

describe("continuation", () => {
  it("groups active continue watching and dormant shows", () => {
    const active = {
      ...progressSummary,
      updatedAt: "2026-07-14T00:00:00.000Z",
    };
    const dormantProgress = {
      ...progressSummary,
      showId: "2002",
      tmdbId: 2002,
      title: "Dormant Show",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const dormantWatchlist = {
      ...watchlistItem,
      itemId: "tv_2002",
      tmdbId: 2002,
      title: "Dormant Show",
    };

    const groups = buildContinuationGroups(
      [watchlistItem, dormantWatchlist],
      [active, dormantProgress],
      now,
      DORMANT_AFTER_DAYS,
    );

    expect(groups.continueWatching.map((entry) => entry.tmdbId)).toEqual([1001]);
    expect(groups.dormant.map((entry) => entry.tmdbId)).toEqual([2002]);
  });

  it("excludes dropped and completed watchlist titles", () => {
    const dropped = {...watchlistItem, status: "dropped" as const};
    const completed = {...watchlistItem, status: "completed" as const};

    expect(buildContinuationGroups([dropped], [progressSummary], now)).toEqual({
      continueWatching: [],
      dormant: [],
    });
    expect(buildContinuationGroups([completed], [progressSummary], now)).toEqual({
      continueWatching: [],
      dormant: [],
    });
  });

  it("includes progress-only shows without a watchlist row", () => {
    const groups = buildContinuationGroups([], [progressSummary], now);

    expect(groups.continueWatching).toHaveLength(1);
    expect(groups.continueWatching[0].title).toBe(progressSummary.title);
    expect(groups.continueWatching[0].watchlistItem).toBeNull();
  });

  it("builds optimistic progress and suggested watchlist status", () => {
    const optimistic = optimisticMarkNextEpisode(progressSummary);

    expect(optimistic.watchedEpisodeCount).toBe(2);
    expect(optimistic.nextEpisode).toEqual(progressSummary.nextEpisode);
    expect(optimistic.progressPercent).toBeCloseTo(66.67);
    expect(suggestedWatchlistStatusForProgress(progressSummary)).toBe("watching");
    expect(
      suggestedWatchlistStatusForProgress({
        ...progressSummary,
        watchedEpisodeCount: 3,
        progressPercent: 100,
        nextEpisode: null,
      }),
    ).toBe("completed");
  });
});
