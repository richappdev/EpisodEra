import assert from "node:assert/strict";
import test from "node:test";
import {FieldValue, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {accountDeletionService} from "./accountDeletionService";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

const ensureFirebaseApp = () => {
  if (getApps().length === 0) {
    initializeApp({projectId: "demo-episodera-tests"});
  }
};

const seedUser = async (userId: string) => {
  const firestore = getFirestore();
  const userRef = firestore.collection("users").doc(userId);

  await userRef.set({
    firstName: "Delete",
    lastName: "Me",
    email: "delete-me@example.com",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await userRef.collection("watchlist").doc("tv_95396").set({
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    status: "watching",
    addedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const progressRef = userRef.collection("progress").doc("95396");
  await progressRef.set({
    tmdbId: 95396,
    title: "Severance",
    watchedEpisodeCount: 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await progressRef.collection("episodes").doc("s01e01").set({
    seasonNumber: 1,
    episodeNumber: 1,
    watched: true,
    watchedAt: FieldValue.serverTimestamp(),
  });

  await userRef.collection("history").doc("tv_95396_s01e01").set({
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    seasonNumber: 1,
    episodeNumber: 1,
    watchedAt: FieldValue.serverTimestamp(),
  });

  await userRef.collection("settings").doc("profile").set({
    language: "en-US",
    autoMarkPreviousEpisodesWatched: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await userRef.collection("ratings").doc("tv_95396").set({
    tmdbId: 95396,
    mediaType: "tv",
    rating: 4.5,
    updatedAt: FieldValue.serverTimestamp(),
  });
};

test("account deletion service removes all Firestore user documents", {
  skip: emulatorHost ? false : "Set FIRESTORE_EMULATOR_HOST to run Firestore emulator integration tests.",
}, async () => {
  ensureFirebaseApp();
  const userId = "account-deletion-emulator-user";
  const firestore = getFirestore();
  const userRef = firestore.collection("users").doc(userId);

  await seedUser(userId);
  assert.equal((await userRef.collection("watchlist").get()).size, 1);
  assert.equal((await userRef.collection("progress").doc("95396").collection("episodes").get()).size, 1);

  await accountDeletionService.deleteUserData(userId);

  assert.equal((await userRef.get()).exists, false);
  assert.equal((await userRef.collection("watchlist").get()).size, 0);
  assert.equal((await userRef.collection("progress").get()).size, 0);
  assert.equal((await userRef.collection("history").get()).size, 0);
  assert.equal((await userRef.collection("settings").get()).size, 0);
  assert.equal((await userRef.collection("ratings").get()).size, 0);
});
