import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test, {after} from "node:test";
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
let testEnvironment: Promise<RulesTestEnvironment> | null = null;

const getTestEnvironment = () => {
  if (!testEnvironment) {
    testEnvironment = initializeTestEnvironment({
      projectId: "demo-episodera-rules",
      firestore: {
        host: "127.0.0.1",
        port: Number(emulatorHost?.split(":")[1] ?? 8080),
        rules: readFileSync(path.resolve(process.cwd(), "../firestore.rules"), "utf8"),
      },
    });
  }

  return testEnvironment;
};

const clearData = async () => {
  const environment = await getTestEnvironment();
  await environment.clearFirestore();
};

after(async () => {
  if (testEnvironment) {
    await (await testEnvironment).cleanup();
  }
});

const withAuthedDb = async (uid: string) => {
  const environment = await getTestEnvironment();
  return environment.authenticatedContext(uid).firestore();
};

const withUnauthedDb = async () => {
  const environment = await getTestEnvironment();
  return environment.unauthenticatedContext().firestore();
};

const skipWithoutEmulator = emulatorHost ? false : "Set FIRESTORE_EMULATOR_HOST to run Firestore rules tests.";

test("rules allow users to read and write their own valid watchlist items", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");

  await assertSucceeds(setDoc(doc(db, "users/alice/watchlist/tv_95396"), {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    poster: null,
    backdrop: null,
    status: "watching",
  }));

  await assertSucceeds(getDoc(doc(db, "users/alice/watchlist/tv_95396")));
});

test("rules deny cross-user and unauthenticated user data access", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const aliceDb = await withAuthedDb("alice");
  const bobDb = await withAuthedDb("bob");
  const publicDb = await withUnauthedDb();

  await assertSucceeds(setDoc(doc(aliceDb, "users/alice/settings/profile"), {
    autoMarkPreviousEpisodesWatched: true,
    language: "en-US",
  }));

  await assertFails(getDoc(doc(bobDb, "users/alice/settings/profile")));
  await assertFails(getDoc(doc(publicDb, "users/alice/settings/profile")));
});

test("rules reject unexpected fields and invalid watchlist status", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");

  await assertFails(setDoc(doc(db, "users/alice/watchlist/tv_95396"), {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    status: "watching",
    ownerUid: "alice",
  }));

  await assertFails(setDoc(doc(db, "users/alice/watchlist/tv_95396"), {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    status: "finished",
  }));
});

test("rules require valid user profile names and email", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");

  await assertSucceeds(setDoc(doc(db, "users/alice"), {
    firstName: "Ada",
    lastName: "Viewer",
    email: "ada@example.com",
    displayName: "Ada Viewer",
    bio: null,
  }));

  await assertFails(setDoc(doc(db, "users/alice"), {
    firstName: "Ada",
    email: "ada@example.com",
  }));

  await assertFails(setDoc(doc(db, "users/alice"), {
    firstName: "",
    lastName: "Viewer",
    email: "ada@example.com",
  }));
});

test("rules deny client writes to server-managed friendCode", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");

  await assertFails(setDoc(doc(db, "users/alice"), {
    firstName: "Ada",
    lastName: "Viewer",
    email: "ada@example.com",
    friendCode: "AB12CD",
  }));
});

test("rules validate progress summaries and nested episode documents", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");

  await assertSucceeds(setDoc(doc(db, "users/alice/progress/95396"), {
    tmdbId: 95396,
    title: "Severance",
    totalEpisodes: 3,
    watchedEpisodeCount: 1,
    progressPercent: 33.33,
    currentSeason: 1,
    currentEpisode: 1,
    nextEpisode: {
      episodeKey: "s01e02",
      seasonNumber: 1,
      episodeNumber: 2,
      episodeTitle: "Half Loop",
    },
  }));

  await assertSucceeds(setDoc(doc(db, "users/alice/progress/95396/episodes/s01e01"), {
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Good News About Hell",
    watched: true,
  }));

  await assertFails(setDoc(doc(db, "users/alice/progress/95396"), {
    tmdbId: 95396,
    title: "Severance",
    totalEpisodes: 3,
    watchedEpisodeCount: 4,
    progressPercent: 133.33,
    currentSeason: 1,
    currentEpisode: 4,
  }));

  await assertFails(setDoc(doc(db, "users/alice/progress/95396/episodes/bad-key"), {
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Good News About Hell",
    watched: true,
  }));
});

test("rules validate history, settings, ratings, and public access", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const db = await withAuthedDb("alice");
  const publicDb = await withUnauthedDb();

  await assertSucceeds(setDoc(doc(db, "users/alice/history/tv_95396_s01e01"), {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Good News About Hell",
  }));

  await assertSucceeds(setDoc(doc(db, "users/alice/settings/profile"), {
    autoMarkPreviousEpisodesWatched: false,
    language: "zh-TW",
  }));

  await assertSucceeds(setDoc(doc(db, "users/alice/ratings/movie_550"), {
    tmdbId: 550,
    mediaType: "movie",
    rating: 4.5,
    review: null,
  }));

  await assertFails(setDoc(doc(db, "users/alice/settings/profile"), {
    autoMarkPreviousEpisodesWatched: false,
    language: "fr-FR",
  }));

  await assertFails(setDoc(doc(db, "users/alice/ratings/movie_550"), {
    tmdbId: 550,
    mediaType: "movie",
    rating: 6,
  }));

  await assertSucceeds(getDoc(doc(publicDb, "public/landing")));
  await assertFails(setDoc(doc(publicDb, "public/landing"), {
    title: "No writes",
  }));

  assert.ok(true);
});

test("rules deny client read and write on franchises catalogs", {
  skip: skipWithoutEmulator,
}, async () => {
  await clearData();
  const environment = await getTestEnvironment();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "franchises/star-wars"), {
      slug: "star-wars",
      name: "Star Wars",
      description: "Test",
      published: true,
      phases: [],
      titles: [],
    });
  });

  const db = await withAuthedDb("alice");
  const publicDb = await withUnauthedDb();

  await assertFails(getDoc(doc(db, "franchises/star-wars")));
  await assertFails(getDoc(doc(publicDb, "franchises/star-wars")));
  await assertFails(setDoc(doc(db, "franchises/star-wars"), {
    slug: "star-wars",
    name: "Hacked",
  }));
});
