import {describe, expect, it} from "vitest";
import {withPagination} from "./pagination";

describe("withPagination", () => {
  it("returns the original path when no pagination is provided", () => {
    expect(withPagination("/watchlist")).toBe("/watchlist");
  });

  it("appends page and pageSize query params", () => {
    expect(withPagination("/watchlist", {page: 2, pageSize: 50})).toBe("/watchlist?page=2&pageSize=50");
    expect(withPagination("/search?q=test", {page: 3})).toBe("/search?q=test&page=3");
  });
});
