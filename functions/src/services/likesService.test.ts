import assert from "node:assert/strict";
import test from "node:test";
import {HttpError} from "../lib/httpError";
import {parseAddLikedItemInput} from "./likesService";

test("parseAddLikedItemInput accepts a valid movie like payload", () => {
  const input = parseAddLikedItemInput({
    tmdbId: 550,
    mediaType: "movie",
    title: " Fight Club ",
    poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    backdrop: null,
  });

  assert.deepEqual(input, {
    tmdbId: 550,
    mediaType: "movie",
    title: "Fight Club",
    poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    backdrop: null,
  });
});

test("parseAddLikedItemInput normalizes optional images", () => {
  assert.deepEqual(
    parseAddLikedItemInput({
      tmdbId: "95396",
      mediaType: "tv",
      title: " Severance ",
    }),
    {
      tmdbId: 95396,
      mediaType: "tv",
      title: "Severance",
      poster: null,
      backdrop: null,
    },
  );
});

test("parseAddLikedItemInput rejects invalid payloads", () => {
  assert.throws(
    () => parseAddLikedItemInput(null),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
  assert.throws(
    () => parseAddLikedItemInput({tmdbId: 0, mediaType: "movie", title: "Bad"}),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
  assert.throws(
    () => parseAddLikedItemInput({tmdbId: 1, mediaType: "game", title: "Bad"}),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
  assert.throws(
    () => parseAddLikedItemInput({tmdbId: 1, mediaType: "tv", title: "   "}),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
  assert.throws(
    () => parseAddLikedItemInput({tmdbId: 1, mediaType: "tv", title: "Show", poster: 1}),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
  assert.throws(
    () => parseAddLikedItemInput({tmdbId: 1, mediaType: "tv", title: "Show", backdrop: false}),
    (error: unknown) => error instanceof HttpError && error.code === "invalid_likes_payload",
  );
});
