import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {Timestamp} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {
  historyIdForCoords,
  historyIdForEpisode,
  historyIdForMovie,
  mapHistoryDocument,
  mapHistoryFromSupabase,
  parseHistoryWatchedAt,
  parseUpdateHistoryInput,
} from "./historyService";

describe("historyService helpers", () => {
  it("builds stable movie and episode ids", () => {
    assert.equal(historyIdForMovie(550), "movie_550");
    assert.equal(historyIdForEpisode(1399, 1, 2), "tv_1399_s01e02");
    assert.equal(
      historyIdForCoords({
        mediaType: "movie",
        tmdbId: 550,
        seasonNumber: null,
        episodeNumber: null,
      }),
      "movie_550",
    );
    assert.equal(
      historyIdForCoords({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 2,
      }),
      "tv_1399_s01e02",
    );
    assert.equal(
      historyIdForCoords({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: null,
        episodeNumber: 2,
      }),
      null,
    );
  });

  it("maps history documents with default rewatchCount", () => {
    assert.deepEqual(
      mapHistoryDocument("tv_1_s01e01", {
        tmdbId: 1,
        mediaType: "tv",
        title: "Show",
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: "Pilot",
      }),
      {
        historyId: "tv_1_s01e01",
        tmdbId: 1,
        mediaType: "tv",
        title: "Show",
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: "Pilot",
        watchedAt: null,
        updatedAt: null,
        rewatchCount: 0,
        genreNames: [],
        runtimeMinutes: null,
      },
    );
  });

  it("maps complete Firestore history documents", () => {
    const watchedAt = Timestamp.fromDate(new Date("2026-07-14T12:00:00.000Z"));
    const updatedAt = Timestamp.fromDate(new Date("2026-07-15T12:00:00.000Z"));

    assert.deepEqual(
      mapHistoryDocument("movie_550", {
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt,
        updatedAt,
        rewatchCount: 2,
        genreNames: ["Drama", "", 12] as unknown as string[],
        runtimeMinutes: 139,
      }),
      {
        historyId: "movie_550",
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: "2026-07-14T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z",
        rewatchCount: 2,
        genreNames: ["Drama"],
        runtimeMinutes: 139,
      },
    );
  });

  it("maps Supabase rows and applies safe defaults", () => {
    assert.deepEqual(
      mapHistoryFromSupabase({
        history_key: "movie_550",
        tmdb_id: "550",
        media_type: "movie",
        title: "Fight Club",
        watched_at: "2026-07-14T12:00:00.000Z",
        updated_at: "2026-07-15T12:00:00.000Z",
        rewatch_count: 3,
        genre_names: ["Drama", " ", 12],
        runtime_minutes: 139,
      }),
      {
        historyId: "movie_550",
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        watchedAt: "2026-07-14T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z",
        rewatchCount: 3,
        genreNames: ["Drama"],
        runtimeMinutes: 139,
      },
    );

    const defaults = mapHistoryFromSupabase({});
    assert.ok(Number.isNaN(defaults.tmdbId));
    assert.deepEqual({...defaults, tmdbId: 0}, {
      historyId: "",
      tmdbId: 0,
      mediaType: "tv",
      title: "",
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
      watchedAt: null,
      updatedAt: null,
      rewatchCount: 0,
      genreNames: [],
      runtimeMinutes: null,
    });
  });

  it("parses watchedAt update payloads", () => {
    assert.deepEqual(parseUpdateHistoryInput({watchedAt: "2026-07-14T12:00:00.000Z"}), {
      watchedAt: "2026-07-14T12:00:00.000Z",
    });
    assert.equal(
      parseHistoryWatchedAt("2026-07-14T12:00:00.000Z").toISOString(),
      "2026-07-14T12:00:00.000Z",
    );
    assert.throws(() => parseHistoryWatchedAt(null), (error: unknown) => error instanceof HttpError);
    assert.throws(() => parseHistoryWatchedAt("  "), (error: unknown) => error instanceof HttpError);
    assert.throws(() => parseHistoryWatchedAt("nope"), (error: unknown) => error instanceof HttpError);
    assert.throws(() => parseUpdateHistoryInput(null), (error: unknown) => error instanceof HttpError);
    assert.throws(() => parseUpdateHistoryInput({}), (error: unknown) => error instanceof HttpError);
  });
});
