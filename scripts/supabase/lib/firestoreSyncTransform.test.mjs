import test from "node:test";
import assert from "node:assert/strict";
import {
  friendDocFromSupabase,
  historyDocFromSupabase,
  profileDocFromSupabase,
  progressDocFromSupabase,
  watchlistDocFromSupabase,
} from "./firestoreSyncTransform.mjs";

test("profileDocFromSupabase maps snake_case fields", () => {
  const doc = profileDocFromSupabase({
    firebase_uid: "u1",
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    display_name: "Ada",
    friend_code: "AB12CD",
  });
  assert.equal(doc.firstName, "Ada");
  assert.equal(doc.friendCode, "AB12CD");
});

test("watchlistDocFromSupabase builds item id", () => {
  const mapped = watchlistDocFromSupabase({
    media_type: "tv",
    tmdb_id: 95396,
    title: "Severance",
    status: "watching",
    poster_path: "/p.jpg",
  });
  assert.equal(mapped.itemId, "tv_95396");
  assert.equal(mapped.data.status, "watching");
});

test("progressDocFromSupabase rebuilds nextEpisode", () => {
  const mapped = progressDocFromSupabase({
    show_tmdb_id: 1,
    title: "Show",
    next_season_number: 1,
    next_episode_number: 3,
    next_episode_title: "Next",
    watched_episode_keys: ["s01e01"],
  });
  assert.equal(mapped.showId, "1");
  assert.equal(mapped.data.nextEpisode.episodeKey, "s01e03");
});

test("historyDocFromSupabase uses history_key", () => {
  const mapped = historyDocFromSupabase({
    history_key: "movie_550",
    media_type: "movie",
    tmdb_id: 550,
    title: "Fight Club",
  });
  assert.equal(mapped.historyId, "movie_550");
});

test("friendDocFromSupabase normalizes pending", () => {
  const mapped = friendDocFromSupabase({
    firebase_uid: "a",
    friend_firebase_uid: "b",
    status: "pending",
    display_name: "Bob",
  });
  assert.equal(mapped.friendUserId, "b");
  assert.equal(mapped.data.status, "pending_outgoing");
});
