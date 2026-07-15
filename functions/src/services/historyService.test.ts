import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HttpError} from "../lib/httpError";
import {mapHistoryDocument, parseHistoryWatchedAt, parseUpdateHistoryInput} from "./historyService";

describe("historyService helpers", () => {
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

  it("parses watchedAt update payloads", () => {
    assert.deepEqual(parseUpdateHistoryInput({watchedAt: "2026-07-14T12:00:00.000Z"}), {
      watchedAt: "2026-07-14T12:00:00.000Z",
    });
    assert.throws(() => parseHistoryWatchedAt("nope"), (error: unknown) => error instanceof HttpError);
    assert.throws(() => parseUpdateHistoryInput({}), (error: unknown) => error instanceof HttpError);
  });
});
