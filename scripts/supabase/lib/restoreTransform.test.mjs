import test from "node:test";
import assert from "node:assert/strict";
import {buildUserRestoreBatches, mapHistoryRow, mapShowProgressRow} from "./restoreTransform.mjs";

test("mapShowProgressRow maps nextEpisode and keys", () => {
  const row = mapShowProgressRow("uid", "95396", {
    tmdbId: 95396,
    title: "Severance",
    totalEpisodes: 10,
    watchedEpisodeCount: 1,
    progressPercent: 10,
    watchedEpisodeKeys: ["s01e01"],
    nextEpisode: {seasonNumber: 1, episodeNumber: 2, episodeTitle: "Next"},
  });
  assert.equal(row.show_tmdb_id, 95396);
  assert.equal(row.next_season_number, 1);
  assert.equal(row.next_episode_number, 2);
  assert.deepEqual(row.watched_episode_keys, ["s01e01"]);
});

test("mapHistoryRow builds deterministic history_key from id", () => {
  const row = mapHistoryRow("uid", "tv_95396_s01e01", {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Pilot",
    rewatchCount: 2,
    genreNames: ["Drama"],
  });
  assert.equal(row.history_key, "tv_95396_s01e01");
  assert.equal(row.rewatch_count, 2);
});

test("buildUserRestoreBatches aggregates collections", () => {
  const batches = buildUserRestoreBatches({
    uid: "uid-1",
    profile: {id: "uid-1", data: {firstName: "Ada", lastName: "L", email: "a@b.c"}},
    settings: {id: "profile", data: {language: "en-US"}},
    watchlist: [{id: "movie_1", data: {tmdbId: 1, mediaType: "movie", title: "M", status: "watched"}}],
    likes: [{id: "movie_1", data: {tmdbId: 1, mediaType: "movie", title: "M"}}],
    progress: [
      {
        id: "10",
        data: {tmdbId: 10, title: "Show", totalEpisodes: 2, watchedEpisodeKeys: ["s01e01"]},
        episodes: [
          {id: "s01e01", data: {seasonNumber: 1, episodeNumber: 1, episodeTitle: "E1", watched: true}},
        ],
      },
    ],
    history: [{id: "movie_1", data: {tmdbId: 1, mediaType: "movie", title: "M"}}],
    friends: [{id: "uid-2", data: {status: "accepted", displayName: "Bob", friendCode: "ABC123"}}],
  });
  assert.equal(batches.profile.first_name, "Ada");
  assert.equal(batches.watchlist.length, 1);
  assert.equal(batches.likes.length, 1);
  assert.equal(batches.progress.length, 1);
  assert.equal(batches.episodes.length, 1);
  assert.equal(batches.history.length, 1);
  assert.equal(batches.friendships[0].status, "accepted");
});
