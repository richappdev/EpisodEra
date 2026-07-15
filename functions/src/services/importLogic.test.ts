import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  mergeWatchlistStatus,
  parseImportWatchedAt,
  pickEarliestWatchedAt,
  stagedEpisodeDocId,
  stagedShowDocId,
} from "./importLogic";

describe("importLogic", () => {
  it("never downgrades TV watchlist status on merge", () => {
    assert.equal(mergeWatchlistStatus("tv", "watching", "planned"), "watching");
    assert.equal(mergeWatchlistStatus("tv", "planned", "watching"), "watching");
    assert.equal(mergeWatchlistStatus("tv", "watching", "completed"), "completed");
    assert.equal(mergeWatchlistStatus("tv", "completed", "watching"), "completed");
  });

  it("never downgrades movie watchlist status on merge", () => {
    assert.equal(mergeWatchlistStatus("movie", "watched", "unwatched"), "watched");
    assert.equal(mergeWatchlistStatus("movie", "unwatched", "watched"), "watched");
  });

  it("picks the earliest watchedAt timestamp", () => {
    const earlier = new Date("2018-01-01T00:00:00.000Z");
    const later = new Date("2020-01-01T00:00:00.000Z");
    assert.equal(pickEarliestWatchedAt(later, earlier, new Date()).toISOString(), earlier.toISOString());
    assert.equal(pickEarliestWatchedAt(null, earlier, later).toISOString(), earlier.toISOString());
    assert.equal(pickEarliestWatchedAt(null, null, later).toISOString(), later.toISOString());
  });

  it("parses import watchedAt ISO strings", () => {
    assert.equal(parseImportWatchedAt("2019-06-01T12:00:00Z")?.toISOString(), "2019-06-01T12:00:00.000Z");
    assert.equal(parseImportWatchedAt("not-a-date"), null);
    assert.equal(parseImportWatchedAt(null), null);
  });

  it("builds deterministic staged document ids", () => {
    assert.equal(stagedShowDocId("tv", 1396), "tv_1396");
    assert.equal(stagedEpisodeDocId(1396, 1, 3), "tv_1396_s01e03");
  });
});
