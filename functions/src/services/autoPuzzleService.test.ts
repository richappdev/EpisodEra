import assert from "node:assert/strict";
import test from "node:test";
import {MediaDetail} from "../models/media";
import {buildAutoPuzzleHints, buildChoicesFromTitles} from "./autoPuzzleService";

const sampleDetail = (overrides: Partial<MediaDetail> = {}): MediaDetail => ({
  id: 1,
  mediaType: "tv",
  title: "Severance",
  overview: "",
  releaseDate: "2022-02-18",
  voteAverage: 8,
  popularity: 100,
  images: {poster: null, backdrop: null},
  genres: [
    {id: 18, name: "Drama"},
    {id: 878, name: "Sci-Fi & Fantasy"},
  ],
  runtimeMinutes: null,
  status: "Returning Series",
  originalLanguage: "en",
  homepage: null,
  ...overrides,
});

test("buildAutoPuzzleHints includes year and all genres", () => {
  const hints = buildAutoPuzzleHints(sampleDetail());
  assert.deepEqual(hints, [
    {revealAfterAttempt: 1, type: "year", value: "2022"},
    {revealAfterAttempt: 2, type: "genre", value: "Drama, Sci-Fi & Fantasy"},
  ]);
});

test("buildAutoPuzzleHints omits empty year or genres", () => {
  const hints = buildAutoPuzzleHints(
    sampleDetail({
      releaseDate: null,
      genres: [],
    }),
  );
  assert.deepEqual(hints, []);
});

test("buildChoicesFromTitles pads to four choices with correct first", () => {
  const choices = buildChoicesFromTitles("Severance", ["Silo", "FROM"]);
  assert.equal(choices.length, 4);
  assert.equal(choices[0]?.choiceId, "a");
  assert.equal(choices[0]?.title, "Severance");
  assert.equal(choices[1]?.title, "Silo");
  assert.equal(choices[2]?.title, "FROM");
  assert.equal(choices[3]?.title, "Option 4");
});

test("buildChoicesFromTitles keeps first four titles only", () => {
  const choices = buildChoicesFromTitles("A", ["B", "C", "D", "E"]);
  assert.deepEqual(
    choices.map((choice) => choice.title),
    ["A", "B", "C", "D"],
  );
});
