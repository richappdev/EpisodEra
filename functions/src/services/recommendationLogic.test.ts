import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  continueFranchiseSuggestions,
  dedupeMediaSummaries,
  filterByRuntime,
  isDiscoveryMood,
  moodDefinitions,
  parseProviderIds,
  titleMatchesProviders,
} from "./recommendationLogic";

describe("recommendationLogic", () => {
  it("validates moods and parses provider ids", () => {
    assert.equal(isDiscoveryMood("relaxing"), true);
    assert.equal(isDiscoveryMood("unknown"), false);
    assert.deepEqual(parseProviderIds("8, 337,8"), [8, 337]);
    assert.deepEqual(parseProviderIds(null), []);
    assert.deepEqual(parseProviderIds(["8", "invalid", "0"]), [8]);
    assert.equal(moodDefinitions["quick-watch"].maxRuntimeMinutes, 30);
  });

  it("filters runtime, providers, and duplicates", () => {
    assert.equal(filterByRuntime([{runtimeMinutes: 25}, {runtimeMinutes: 90}], 30).length, 1);
    const unfiltered = [{runtimeMinutes: 90}];
    assert.equal(filterByRuntime(unfiltered, null), unfiltered);
    assert.equal(titleMatchesProviders([8], []), true);
    assert.equal(titleMatchesProviders(undefined, [337]), true);
    assert.equal(titleMatchesProviders([8], [337]), false);
    assert.equal(titleMatchesProviders([8, 337], [337]), true);
    assert.equal(
      dedupeMediaSummaries([
        {
          id: 1,
          mediaType: "movie",
          title: "A",
          overview: "",
          releaseDate: null,
          voteAverage: 0,
          popularity: 0,
          images: {poster: null, backdrop: null},
        },
        {
          id: 1,
          mediaType: "movie",
          title: "A again",
          overview: "",
          releaseDate: null,
          voteAverage: 0,
          popularity: 0,
          images: {poster: null, backdrop: null},
        },
      ]).length,
      1,
    );
  });

  it("continues unfinished franchise titles within a time budget", () => {
    const results = continueFranchiseSuggestions(
      [
        {
          tmdbId: 1,
          mediaType: "movie",
          title: "Short",
          phaseId: "a",
          phaseName: "A",
          releaseOrder: 1,
          chronologicalOrder: 1,
          runtimeMinutes: 25,
          status: "unwatched",
          progressPercent: 0,
        },
        {
          tmdbId: 2,
          mediaType: "movie",
          title: "Long",
          phaseId: "a",
          phaseName: "A",
          releaseOrder: 2,
          chronologicalOrder: 2,
          runtimeMinutes: 140,
          status: "unwatched",
          progressPercent: 0,
        },
      ],
      30,
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].tmdbId, 1);
  });
});
