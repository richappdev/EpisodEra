import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HttpError} from "../lib/httpError";
import {
  parseAddWatchlistItemInput,
  parseWatchlistStatusInput,
} from "./watchlistService";

const expectWatchlistError = (callback: () => unknown, code: string) => {
  assert.throws(
    callback,
    (error: unknown) => error instanceof HttpError && error.code === code,
  );
};

describe("watchlistService input parsers", () => {
  it("normalizes movie payloads and applies the default status", () => {
    assert.deepEqual(
      parseAddWatchlistItemInput({
        tmdbId: "550",
        mediaType: "movie",
        title: " Fight Club ",
        poster: " https://image.tmdb.org/poster.jpg ",
        backdrop: null,
      }),
      {
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        poster: "https://image.tmdb.org/poster.jpg",
        backdrop: null,
        status: "unwatched",
      },
    );
  });

  it("accepts explicit TV and movie statuses", () => {
    assert.deepEqual(
      parseAddWatchlistItemInput({
        tmdbId: 95396,
        mediaType: "tv",
        title: "Severance",
        status: "watching",
      }),
      {
        tmdbId: 95396,
        mediaType: "tv",
        title: "Severance",
        poster: null,
        backdrop: null,
        status: "watching",
      },
    );
    assert.equal(parseWatchlistStatusInput({status: "completed"}), "completed");
  });

  it("rejects malformed item payloads", () => {
    expectWatchlistError(() => parseAddWatchlistItemInput(null), "invalid_watchlist_payload");
    expectWatchlistError(
      () => parseAddWatchlistItemInput({tmdbId: 0, mediaType: "movie", title: "Movie"}),
      "invalid_watchlist_payload",
    );
    expectWatchlistError(
      () => parseAddWatchlistItemInput({tmdbId: 1, mediaType: "game", title: "Game"}),
      "invalid_watchlist_payload",
    );
    expectWatchlistError(
      () => parseAddWatchlistItemInput({tmdbId: 1, mediaType: "tv", title: " "}),
      "invalid_watchlist_payload",
    );
    expectWatchlistError(
      () =>
        parseAddWatchlistItemInput({
          tmdbId: 1,
          mediaType: "tv",
          title: "Show",
          poster: 123,
        }),
      "invalid_watchlist_payload",
    );
  });

  it("rejects unsupported or media-incompatible statuses", () => {
    expectWatchlistError(
      () =>
        parseAddWatchlistItemInput({
          tmdbId: 1,
          mediaType: "tv",
          title: "Show",
          status: "paused",
        }),
      "invalid_status",
    );
    expectWatchlistError(
      () =>
        parseAddWatchlistItemInput({
          tmdbId: 550,
          mediaType: "movie",
          title: "Fight Club",
          status: "watching",
        }),
      "invalid_status",
    );
    expectWatchlistError(
      () =>
        parseAddWatchlistItemInput({
          tmdbId: 95396,
          mediaType: "tv",
          title: "Severance",
          status: "watched",
        }),
      "invalid_status",
    );
    expectWatchlistError(() => parseWatchlistStatusInput(null), "invalid_status");
    expectWatchlistError(
      () => parseWatchlistStatusInput({status: "paused"}),
      "invalid_status",
    );
  });
});
