import {describe, expect, it} from "vitest";
import {
  isActiveWatchlistStatus,
  isContinueEligibleStatus,
  isLibraryWatchlistStatus,
  watchlistStatuses,
} from "./watchlist";

describe("watchlist status helpers", () => {
  it("classifies active queue statuses", () => {
    expect(isActiveWatchlistStatus("watching")).toBe(true);
    expect(isActiveWatchlistStatus("unwatched")).toBe(true);
    for (const status of watchlistStatuses) {
      if (status === "watching" || status === "unwatched") {
        continue;
      }
      expect(isActiveWatchlistStatus(status)).toBe(false);
    }
  });

  it("classifies continue-watching eligible statuses", () => {
    expect(isContinueEligibleStatus("watching")).toBe(true);
    expect(isContinueEligibleStatus("planned")).toBe(true);
    expect(isContinueEligibleStatus("unwatched")).toBe(true);
    expect(isContinueEligibleStatus("completed")).toBe(false);
    expect(isContinueEligibleStatus("dropped")).toBe(false);
    expect(isContinueEligibleStatus("watched")).toBe(false);
  });

  it("classifies library archive statuses", () => {
    expect(isLibraryWatchlistStatus("planned")).toBe(true);
    expect(isLibraryWatchlistStatus("completed")).toBe(true);
    expect(isLibraryWatchlistStatus("watched")).toBe(true);
    expect(isLibraryWatchlistStatus("watching")).toBe(false);
    expect(isLibraryWatchlistStatus("dropped")).toBe(false);
    expect(isLibraryWatchlistStatus("unwatched")).toBe(false);
  });
});
