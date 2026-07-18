import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  itemNeedsImageBackfill,
  mapInChunks,
  mergeWatchlistImages,
  needsImageUrl,
  normalizeImageUrl,
  preferImageUrl,
} from "./watchlistPosterLogic";

describe("watchlistPosterLogic", () => {
  it("treats blank strings as missing image URLs", () => {
    assert.equal(needsImageUrl(null), true);
    assert.equal(needsImageUrl(undefined), true);
    assert.equal(needsImageUrl(""), true);
    assert.equal(needsImageUrl("   "), true);
    assert.equal(needsImageUrl("https://image.tmdb.org/t/p/w500/x.jpg"), false);

    assert.equal(normalizeImageUrl(""), null);
    assert.equal(normalizeImageUrl("  https://cdn/poster.jpg  "), "https://cdn/poster.jpg");
  });

  it("prefers an existing non-empty URL over incoming", () => {
    assert.equal(
      preferImageUrl("https://cdn/a.jpg", "https://cdn/b.jpg"),
      "https://cdn/a.jpg",
    );
    assert.equal(preferImageUrl("", "https://cdn/b.jpg"), "https://cdn/b.jpg");
    assert.equal(preferImageUrl(null, null), null);
  });

  it("merges only missing poster/backdrop fields", () => {
    assert.deepEqual(
      mergeWatchlistImages(
        {poster: null, backdrop: "https://cdn/backdrop.jpg"},
        {poster: "https://cdn/poster.jpg", backdrop: "https://cdn/other.jpg"},
      ),
      {poster: "https://cdn/poster.jpg", backdrop: "https://cdn/backdrop.jpg"},
    );

    assert.equal(itemNeedsImageBackfill({poster: null, backdrop: null}), true);
    assert.equal(itemNeedsImageBackfill({poster: "", backdrop: "https://cdn/b.jpg"}), true);
    assert.equal(
      itemNeedsImageBackfill({
        poster: "https://cdn/p.jpg",
        backdrop: "https://cdn/b.jpg",
      }),
      false,
    );
  });

  it("maps items in concurrency chunks", async () => {
    const seen: number[][] = [];
    const results = await mapInChunks([1, 2, 3, 4, 5], 2, async (value) => {
      seen.push([value]);
      return value * 10;
    });

    assert.deepEqual(results, [10, 20, 30, 40, 50]);
    assert.equal(seen.length, 5);
  });
});
