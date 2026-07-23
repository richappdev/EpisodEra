import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {HttpError} from "../lib/httpError";
import {
  parseBatchEpisodeProgressInput,
  parseEpisodeProgressInput,
  parseShowId,
} from "./progressService";

const expectProgressError = (callback: () => unknown, code = "invalid_progress_payload") => {
  assert.throws(
    callback,
    (error: unknown) => error instanceof HttpError && error.code === code,
  );
};

describe("progressService input parsers", () => {
  it("normalizes show and episode identifiers", () => {
    assert.deepEqual(parseShowId("1399"), {showId: "1399", tmdbId: 1399});
    assert.deepEqual(
      parseEpisodeProgressInput({seasonNumber: "2", episodeNumber: 3}),
      {seasonNumber: 2, episodeNumber: 3},
    );
  });

  it("deduplicates batch episodes while preserving the last coordinate", () => {
    assert.deepEqual(
      parseBatchEpisodeProgressInput({
        watched: true,
        episodes: [
          {seasonNumber: 1, episodeNumber: 1},
          {seasonNumber: "1", episodeNumber: "1"},
          {seasonNumber: 1, episodeNumber: 2},
        ],
      }),
      {
        watched: true,
        episodes: [
          {seasonNumber: 1, episodeNumber: 1},
          {seasonNumber: 1, episodeNumber: 2},
        ],
      },
    );
  });

  it("rejects invalid show and episode payloads", () => {
    expectProgressError(() => parseShowId("0"), "invalid_show_id");
    expectProgressError(() => parseShowId("1.5"), "invalid_show_id");
    expectProgressError(() => parseEpisodeProgressInput(null));
    expectProgressError(() =>
      parseEpisodeProgressInput({seasonNumber: 0, episodeNumber: 1}),
    );
    expectProgressError(() =>
      parseEpisodeProgressInput({seasonNumber: 1, episodeNumber: "nope"}),
    );
  });

  it("rejects malformed and oversized batch payloads", () => {
    expectProgressError(() => parseBatchEpisodeProgressInput([]));
    expectProgressError(() =>
      parseBatchEpisodeProgressInput({watched: "yes", episodes: [{seasonNumber: 1, episodeNumber: 1}]}),
    );
    expectProgressError(() =>
      parseBatchEpisodeProgressInput({watched: false, episodes: []}),
    );
    expectProgressError(
      () =>
        parseBatchEpisodeProgressInput({
          watched: false,
          episodes: Array.from({length: 101}, (_, index) => ({
            seasonNumber: 1,
            episodeNumber: index + 1,
          })),
        }),
      "batch_too_large",
    );
  });
});
