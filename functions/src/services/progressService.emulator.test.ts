import assert from "node:assert/strict";
import test from "node:test";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {MediaDetail, TvSeasonDetail} from "../models/media";
import {episodeKeyFor} from "./progressLogic";
import {progressService} from "./progressService";
import {tmdbService} from "./tmdbService";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

const tvDetail: MediaDetail = {
  id: 95396,
  mediaType: "tv",
  title: "Severance",
  overview: "",
  releaseDate: "2022-02-17",
  voteAverage: 8.4,
  popularity: 100,
  images: {poster: null, backdrop: null},
  genres: [],
  runtimeMinutes: null,
  status: "Returning Series",
  originalLanguage: "en",
  homepage: null,
  totalEpisodes: 3,
  seasons: [
    {
      id: 1,
      seasonNumber: 1,
      title: "Season 1",
      episodeCount: 3,
      airDate: null,
      poster: null,
    },
  ],
};

const seasonDetail: TvSeasonDetail = {
  id: 1,
  tvId: 95396,
  seasonNumber: 1,
  title: "Season 1",
  overview: "",
  airDate: null,
  poster: null,
  episodeCount: 3,
  episodes: [1, 2, 3].map((episodeNumber) => ({
    id: episodeNumber,
    episodeKey: episodeKeyFor(1, episodeNumber),
    seasonNumber: 1,
    episodeNumber,
    title: `Episode ${episodeNumber}`,
    overview: "",
    airDate: null,
    runtimeMinutes: null,
    still: null,
    voteAverage: 0,
  })),
};

const ensureFirebaseApp = () => {
  if (getApps().length === 0) {
    initializeApp({projectId: "demo-episodera-tests"});
  }
};

const clearUser = async (userId: string) => {
  const firestore = getFirestore();
  await firestore.recursiveDelete(firestore.collection("users").doc(userId));
};

const withMockedTmdb = async (run: () => Promise<void>) => {
  const originalTvDetail = tmdbService.tvDetail;
  const originalTvSeasonDetail = tmdbService.tvSeasonDetail;

  tmdbService.tvDetail = async () => tvDetail;
  tmdbService.tvSeasonDetail = async () => seasonDetail;

  try {
    await run();
  } finally {
    tmdbService.tvDetail = originalTvDetail;
    tmdbService.tvSeasonDetail = originalTvSeasonDetail;
  }
};

test("progress service writes batch episode progress and history transactionally", {
  skip: emulatorHost ? false : "Set FIRESTORE_EMULATOR_HOST to run Firestore emulator integration tests.",
}, async () => {
  ensureFirebaseApp();
  await withMockedTmdb(async () => {
    const userId = "progress-emulator-user-batch";
    await clearUser(userId);

    const progress = await progressService.updateEpisodes(userId, "95396", 95396, {
      watched: true,
      episodes: [
        {seasonNumber: 1, episodeNumber: 1},
        {seasonNumber: 1, episodeNumber: 3},
      ],
    });

    assert.equal(progress.watchedEpisodeCount, 2);
    assert.equal(progress.progressPercent, 66.67);
    assert.equal(progress.currentEpisode, 3);
    assert.equal(progress.nextEpisode?.episodeKey, "s01e02");
    assert.deepEqual(progress.episodes.map((episode) => episode.episodeKey), ["s01e01", "s01e03"]);

    const firestore = getFirestore();
    const history = await firestore
      .collection("users")
      .doc(userId)
      .collection("history")
      .doc("tv_95396_s01e03")
      .get();

    assert.equal(history.exists, true);
    assert.equal(history.get("title"), "Severance");
    assert.equal(history.get("episodeTitle"), "Episode 3");

    await clearUser(userId);
  });
});

test("progress service unwatch removes history and recalculates next episode", {
  skip: emulatorHost ? false : "Set FIRESTORE_EMULATOR_HOST to run Firestore emulator integration tests.",
}, async () => {
  ensureFirebaseApp();
  await withMockedTmdb(async () => {
    const userId = "progress-emulator-user-unwatch";
    await clearUser(userId);

    await progressService.updateEpisodes(userId, "95396", 95396, {
      watched: true,
      episodes: [
        {seasonNumber: 1, episodeNumber: 1},
        {seasonNumber: 1, episodeNumber: 2},
      ],
    });

    const progress = await progressService.updateEpisodes(userId, "95396", 95396, {
      watched: false,
      episodes: [{seasonNumber: 1, episodeNumber: 1}],
    });

    assert.equal(progress.watchedEpisodeCount, 1);
    assert.equal(progress.currentEpisode, 2);
    assert.equal(progress.nextEpisode?.episodeKey, "s01e01");
    assert.deepEqual(progress.episodes.map((episode) => episode.episodeKey), ["s01e02"]);

    const removedHistory = await getFirestore()
      .collection("users")
      .doc(userId)
      .collection("history")
      .doc("tv_95396_s01e01")
      .get();

    assert.equal(removedHistory.exists, false);

    await clearUser(userId);
  });
});

test("progress service duplicate writes are idempotent for counts", {
  skip: emulatorHost ? false : "Set FIRESTORE_EMULATOR_HOST to run Firestore emulator integration tests.",
}, async () => {
  ensureFirebaseApp();
  await withMockedTmdb(async () => {
    const userId = "progress-emulator-user-idempotent";
    await clearUser(userId);

    await progressService.updateEpisodes(userId, "95396", 95396, {
      watched: true,
      episodes: [{seasonNumber: 1, episodeNumber: 1}],
    });
    const progress = await progressService.updateEpisodes(userId, "95396", 95396, {
      watched: true,
      episodes: [{seasonNumber: 1, episodeNumber: 1}],
    });

    assert.equal(progress.watchedEpisodeCount, 1);
    assert.equal(progress.episodes.length, 1);
    assert.equal(progress.nextEpisode?.episodeKey, "s01e02");

    await clearUser(userId);
  });
});
