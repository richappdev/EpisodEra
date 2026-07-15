import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HistoryEntry} from "../models/history";
import {evaluateAchievements} from "./achievementLogic";

const entry = (overrides: Partial<HistoryEntry> & Pick<HistoryEntry, "historyId" | "title">): HistoryEntry => ({
  tmdbId: 1001,
  mediaType: "tv",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  watchedAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  rewatchCount: 0,
  genreNames: ["Crime"],
  runtimeMinutes: 42,
  ...overrides,
});

describe("achievementLogic", () => {
  it("tracks detective, rewatcher, loyal fan, and completionist progress", () => {
    const history = [
      entry({historyId: "1", title: "A", watchedAt: "2024-01-01T00:00:00.000Z"}),
      entry({historyId: "2", title: "A", episodeNumber: 2, watchedAt: "2025-01-01T00:00:00.000Z"}),
      entry({historyId: "3", title: "B", tmdbId: 2, rewatchCount: 2, genreNames: ["Animation"]}),
    ];

    const items = evaluateAchievements({
      history,
      watchlistItems: [],
      progressItems: [],
      franchiseProgress: [
        {
          slug: "demo",
          name: "Demo",
          description: "",
          order: "release",
          totalTitles: 1,
          watchedTitles: 1,
          inProgressTitles: 0,
          progressPercent: 100,
          phases: [],
          titles: [],
          recommendedNext: null,
        },
      ],
    });

    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    assert.equal(byId.detective.current, 2);
    assert.equal(byId.detective.unlocked, false);
    assert.equal(byId["anime-explorer"].current, 1);
    assert.equal(byId["loyal-fan"].current, 2);
    assert.equal(byId["loyal-fan"].unlocked, true);
    assert.equal(byId.completionist.unlocked, true);
    assert.equal(byId.rewatcher.unlocked, true);
  });
});
