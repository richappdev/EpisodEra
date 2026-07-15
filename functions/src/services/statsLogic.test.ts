import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HistoryEntry} from "../models/history";
import {
  buildYearRecap,
  computeStreaks,
  formatWatchTime,
  mostActiveMonth,
  rankGenres,
  rankTitles,
  totalWatchTimeMinutes,
} from "./statsLogic";

const entry = (overrides: Partial<HistoryEntry> & Pick<HistoryEntry, "historyId" | "title" | "watchedAt">): HistoryEntry => ({
  tmdbId: 1001,
  mediaType: "tv",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  updatedAt: overrides.watchedAt,
  rewatchCount: 0,
  genreNames: ["Drama"],
  runtimeMinutes: 42,
  ...overrides,
});

describe("statsLogic", () => {
  it("formats watch time and estimates totals", () => {
    assert.equal(formatWatchTime(45), "45 min");
    assert.equal(formatWatchTime(120), "2 hours");
    assert.equal(
      totalWatchTimeMinutes([
        entry({historyId: "a", title: "A", watchedAt: "2026-07-01T00:00:00.000Z"}),
        entry({
          historyId: "b",
          title: "B",
          mediaType: "movie",
          seasonNumber: null,
          episodeNumber: null,
          episodeTitle: null,
          watchedAt: "2026-07-02T00:00:00.000Z",
          runtimeMinutes: 110,
          genreNames: ["Adventure"],
        }),
      ]),
      152,
    );
  });

  it("computes streaks across consecutive UTC days", () => {
    const streaks = computeStreaks(
      [
        entry({historyId: "1", title: "A", watchedAt: "2026-07-10T12:00:00.000Z"}),
        entry({historyId: "2", title: "B", watchedAt: "2026-07-11T12:00:00.000Z"}),
        entry({historyId: "3", title: "C", watchedAt: "2026-07-13T12:00:00.000Z"}),
      ],
      new Date("2026-07-13T15:00:00.000Z"),
    );

    assert.equal(streaks.longestStreakDays, 2);
    assert.equal(streaks.currentStreakDays, 1);
  });

  it("ranks titles, genres, and most active month", () => {
    const entries = [
      entry({historyId: "1", title: "Show A", tmdbId: 1, watchedAt: "2026-07-01T00:00:00.000Z", rewatchCount: 1}),
      entry({historyId: "2", title: "Show A", tmdbId: 1, episodeNumber: 2, watchedAt: "2026-07-02T00:00:00.000Z"}),
      entry({
        historyId: "3",
        title: "Movie B",
        tmdbId: 9,
        mediaType: "movie",
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: "2026-06-15T00:00:00.000Z",
        genreNames: ["Adventure"],
      }),
    ];

    assert.deepEqual(rankTitles(entries, "tv", 1)[0], {
      tmdbId: 1,
      mediaType: "tv",
      title: "Show A",
      count: 3,
    });
    assert.equal(rankGenres(entries, 1)[0].name, "Drama");
    assert.equal(mostActiveMonth(entries, 2026), "2026-07");
  });

  it("builds a year recap with newly discovered titles", () => {
    const entries = [
      entry({historyId: "1", title: "Show A", tmdbId: 1, watchedAt: "2025-12-31T00:00:00.000Z"}),
      entry({historyId: "2", title: "Show B", tmdbId: 2, watchedAt: "2026-03-01T00:00:00.000Z", genreNames: ["Comedy"]}),
      entry({
        historyId: "3",
        title: "Movie C",
        tmdbId: 3,
        mediaType: "movie",
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: "2026-03-02T00:00:00.000Z",
        genreNames: ["Adventure"],
        runtimeMinutes: 100,
      }),
    ];

    const recap = buildYearRecap(entries, 2026);
    assert.equal(recap.year, 2026);
    assert.equal(recap.totalWatchedEpisodes, 1);
    assert.equal(recap.totalWatchedMovies, 1);
    assert.equal(recap.topShow?.title, "Show B");
    assert.equal(recap.topMovie?.title, "Movie C");
    assert.equal(recap.newlyDiscovered.map((item) => item.title).sort().join(","), "Movie C,Show B");
  });
});
