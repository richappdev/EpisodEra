import test from "node:test";
import assert from "node:assert/strict";

import {parseUpsertMediaMappingInput} from "./mediaMappingService";
import {HttpError} from "../lib/httpError";

test("parseUpsertMediaMappingInput accepts a valid mapping payload", () => {
  const parsed = parseUpsertMediaMappingInput({
    provider: "tv_time",
    mediaType: "tv",
    externalId: " 123 ",
    tmdbId: 42,
    title: " Demo ",
  });
  assert.deepEqual(parsed, {
    provider: "tv_time",
    mediaType: "tv",
    externalId: "123",
    tmdbId: 42,
    title: "Demo",
  });
});

test("parseUpsertMediaMappingInput rejects invalid payloads", () => {
  assert.throws(() => parseUpsertMediaMappingInput(null), HttpError);
  assert.throws(
    () => parseUpsertMediaMappingInput({provider: "other", mediaType: "tv", externalId: "1", tmdbId: 1}),
    HttpError,
  );
  assert.throws(
    () => parseUpsertMediaMappingInput({provider: "tv_time", mediaType: "tv", externalId: "1", tmdbId: 0}),
    HttpError,
  );
});
