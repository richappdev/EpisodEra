import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {FranchiseCatalog} from "../models/franchise";
import {buildFranchiseProgress, listFranchiseSummaries, sortFranchiseTitles} from "./franchiseLogic";

const catalog: FranchiseCatalog = {
  slug: "demo",
  name: "Demo Franchise",
  description: "Test franchise",
  phases: [
    {id: "early", name: "Early"},
    {id: "late", name: "Late"},
  ],
  titles: [
    {
      tmdbId: 1,
      mediaType: "movie",
      title: "First Release",
      phaseId: "early",
      releaseOrder: 1,
      chronologicalOrder: 2,
      runtimeMinutes: 100,
      providerIds: [8],
    },
    {
      tmdbId: 2,
      mediaType: "movie",
      title: "Second Release",
      phaseId: "late",
      releaseOrder: 2,
      chronologicalOrder: 1,
      runtimeMinutes: 110,
      providerIds: [337],
    },
    {
      tmdbId: 3,
      mediaType: "tv",
      title: "Spin-off Show",
      phaseId: "late",
      releaseOrder: 3,
      chronologicalOrder: 3,
      runtimeMinutes: 45,
      providerIds: [8],
    },
  ],
};

describe("franchiseLogic", () => {
  it("lists summaries and sorts by selected order", () => {
    assert.equal(listFranchiseSummaries([catalog])[0].titleCount, 3);
    assert.deepEqual(
      sortFranchiseTitles(catalog.titles, "chronological").map((title) => title.tmdbId),
      [2, 1, 3],
    );
  });

  it("computes franchise progress and recommends the next unwatched title", () => {
    const progress = buildFranchiseProgress({
      catalog,
      order: "release",
      watchlistItems: [
        {
          itemId: "movie_1",
          tmdbId: 1,
          mediaType: "movie",
          title: "First Release",
          status: "watched",
          poster: null,
          backdrop: null,
          addedAt: null,
          updatedAt: null,
        },
      ],
      progressItems: [
        {
          showId: "3",
          tmdbId: 3,
          title: "Spin-off Show",
          totalEpisodes: 10,
          watchedEpisodeCount: 4,
          progressPercent: 40,
          currentSeason: 1,
          currentEpisode: 4,
          nextEpisode: null,
          updatedAt: null,
        },
      ],
      historyItems: [],
    });

    assert.equal(progress.watchedTitles, 1);
    assert.equal(progress.inProgressTitles, 1);
    assert.equal(progress.recommendedNext?.tmdbId, 2);
    assert.equal(progress.phases.find((phase) => phase.id === "early")?.watchedTitles, 1);
  });

  it("prefers recommended next titles available on preferred providers", () => {
    const progress = buildFranchiseProgress({
      catalog,
      order: "release",
      watchlistItems: [],
      progressItems: [],
      historyItems: [],
      preferredProviderIds: [337],
    });

    assert.equal(progress.recommendedNext?.tmdbId, 2);
  });
});
