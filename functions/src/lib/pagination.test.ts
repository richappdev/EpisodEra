import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  decodePageToken,
  defaultPageSize,
  encodePageToken,
  maxPageSize,
  parsePaginationQuery,
} from "./pagination";

describe("parsePaginationQuery", () => {
  it("uses defaults when query params are missing or invalid", () => {
    assert.deepEqual(parsePaginationQuery({}), {pageSize: defaultPageSize, pageToken: undefined});
    assert.deepEqual(parsePaginationQuery({pageSize: "-1"}), {
      pageSize: defaultPageSize,
      pageToken: undefined,
    });
  });

  it("parses pageSize, caps it, and keeps pageToken", () => {
    assert.deepEqual(parsePaginationQuery({pageSize: "10", pageToken: "abc"}), {
      pageSize: 10,
      pageToken: "abc",
    });
    assert.deepEqual(parsePaginationQuery({pageSize: String(maxPageSize + 50)}), {
      pageSize: maxPageSize,
      pageToken: undefined,
    });
  });
});

describe("pageToken encode/decode", () => {
  it("round-trips cursor payloads", () => {
    const token = encodePageToken({values: ["2026-01-01T00:00:00.000Z", "doc1"], id: "doc1"});
    assert.deepEqual(decodePageToken(token), {
      values: ["2026-01-01T00:00:00.000Z", "doc1"],
      id: "doc1",
    });
  });

  it("rejects invalid tokens", () => {
    assert.throws(() => decodePageToken("not-valid"), (error: {code?: string}) => error.code === "invalid_page_token");
  });
});
