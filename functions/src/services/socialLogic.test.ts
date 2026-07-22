import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HistoryEntry} from "../models/history";
import {
  evaluateChallenges,
  generateFriendCode,
  genreOverlapScore,
  shouldHideSpoiler,
  shouldHideSpoilerByHistoryId,
  topGenreNames,
} from "./socialLogic";

const entry = (overrides: Partial<HistoryEntry> & Pick<HistoryEntry, "historyId" | "title">): HistoryEntry => ({
  tmdbId: 1,
  mediaType: "tv",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  watchedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  rewatchCount: 0,
  genreNames: ["Crime"],
  runtimeMinutes: 40,
  ...overrides,
});

describe("socialLogic", () => {
  it("scores genre overlap and ranks top genres", () => {
    assert.equal(genreOverlapScore(["Crime", "Drama"], ["Crime", "Action"]), 33.33);
    assert.deepEqual(
      topGenreNames([
        entry({historyId: "1", title: "A", genreNames: ["Crime"]}),
        entry({historyId: "2", title: "B", genreNames: ["Crime", "Drama"]}),
      ]),
      ["Crime", "Drama"],
    );
  });

  it("hides spoilers until the viewer has watched the same title or episode", () => {
    const viewerHistory = [entry({historyId: "1", title: "A", seasonNumber: 1, episodeNumber: 1})];
    assert.equal(
      shouldHideSpoiler({
        hideSpoilersUntilWatched: true,
        mediaType: "tv",
        tmdbId: 1,
        seasonNumber: 1,
        episodeNumber: 2,
        viewerHistory,
      }),
      true,
    );
    assert.equal(
      shouldHideSpoiler({
        hideSpoilersUntilWatched: true,
        mediaType: "tv",
        tmdbId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        viewerHistory,
      }),
      false,
    );
    assert.equal(
      shouldHideSpoilerByHistoryId({
        hideSpoilersUntilWatched: true,
        historyId: "tv_1_s01e01",
        watchedHistoryIds: new Set(["tv_1_s01e01"]),
      }),
      false,
    );
    assert.equal(
      shouldHideSpoilerByHistoryId({
        hideSpoilersUntilWatched: true,
        historyId: "tv_1_s01e02",
        watchedHistoryIds: new Set(["tv_1_s01e01"]),
      }),
      true,
    );
  });

  it("evaluates challenges and generates stable friend codes", () => {
    const challenges = evaluateChallenges({
      history: [
        entry({historyId: "1", title: "A", rewatchCount: 2}),
        entry({historyId: "2", title: "B", episodeNumber: 2}),
      ],
      completedFranchises: 1,
    });
    const byId = Object.fromEntries(challenges.map((item) => [item.id, item]));
    assert.equal(byId["crime-marathon"].current, 2);
    assert.equal(byId["franchise-finisher"].completed, true);
    assert.equal(byId["rewatch-club"].current, 2);
    assert.equal(generateFriendCode("user-a").length, 6);
    assert.equal(generateFriendCode("user-a"), generateFriendCode("user-a"));
  });
});
