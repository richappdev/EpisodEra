import {describe, expect, it} from "vitest";
import {withPagination} from "./pagination";

describe("withPagination", () => {
  it("returns the path when pagination is omitted", () => {
    expect(withPagination("/watchlist")).toBe("/watchlist");
  });

  it("appends pageSize and pageToken query params", () => {
    expect(withPagination("/watchlist", {pageSize: 50})).toBe("/watchlist?pageSize=50");
    expect(withPagination("/watchlist", {pageSize: 50, pageToken: "abc"})).toBe(
      "/watchlist?pageSize=50&pageToken=abc",
    );
    expect(withPagination("/search?q=test", {pageSize: 25})).toBe("/search?q=test&pageSize=25");
  });
});
