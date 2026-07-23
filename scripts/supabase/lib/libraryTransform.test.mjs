import test from "node:test";
import assert from "node:assert/strict";
import {mapLikeRow, mapWatchlistRow, normalizeWatchlistStatus} from "./libraryTransform.mjs";

test("normalizeWatchlistStatus maps movie completed to watched", () => {
  assert.equal(normalizeWatchlistStatus("movie", "completed"), "watched");
  assert.equal(normalizeWatchlistStatus("tv", "watching"), "watching");
  assert.equal(normalizeWatchlistStatus("tv", "bogus"), "planned");
});

test("mapWatchlistRow maps firestore poster/backdrop fields", () => {
  const row = mapWatchlistRow("uid-1", "tv_95396", {
    tmdbId: 95396,
    mediaType: "tv",
    title: "Severance",
    poster: "https://image/p.jpg",
    backdrop: "https://image/b.jpg",
    status: "watching",
  });
  assert.equal(row.firebase_uid, "uid-1");
  assert.equal(row.media_type, "tv");
  assert.equal(row.tmdb_id, 95396);
  assert.equal(row.poster_path, "https://image/p.jpg");
  assert.equal(row.status, "watching");
});

test("mapLikeRow returns null for invalid docs", () => {
  assert.equal(mapLikeRow("uid", "bad", {title: "x"}), null);
  const row = mapLikeRow("uid", "movie_550", {
    tmdbId: 550,
    mediaType: "movie",
    title: "Fight Club",
    poster: "https://p",
  });
  assert.equal(row.tmdb_id, 550);
  assert.equal(row.title, "Fight Club");
});
