import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {defaultPageSize, maxPageSize, parsePaginationQuery} from "./pagination";

describe("parsePaginationQuery", () => {
  it("uses defaults when query params are missing or invalid", () => {
    assert.deepEqual(parsePaginationQuery({}), {page: 1, pageSize: defaultPageSize});
    assert.deepEqual(parsePaginationQuery({page: "0", pageSize: "-1"}), {page: 1, pageSize: defaultPageSize});
  });

  it("parses positive integers and caps page size", () => {
    assert.deepEqual(parsePaginationQuery({page: "2", pageSize: "10"}), {page: 2, pageSize: 10});
    assert.deepEqual(parsePaginationQuery({pageSize: String(maxPageSize + 50)}), {
      page: 1,
      pageSize: maxPageSize,
    });
  });
});
