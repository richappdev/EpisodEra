import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {now, stats} from "../../test/fixtures";
import {HistoryEntry} from "../../types/history";
import {useProfileStats} from "../useProfileStats";
import {mockUser, paginated} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    meStats: vi.fn(),
    meHistory: vi.fn(),
  },
}));

const historyEntry: HistoryEntry = {
  historyId: "hist_1",
  tmdbId: 1001,
  mediaType: "tv",
  title: "Critical Flow Show",
  seasonNumber: 1,
  episodeNumber: 1,
  episodeTitle: "Pilot",
  watchedAt: now,
  updatedAt: now,
};

const secondHistoryEntry: HistoryEntry = {
  ...historyEntry,
  historyId: "hist_2",
  episodeNumber: 2,
  episodeTitle: "The Gap",
};

describe("useProfileStats", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads stats and history in parallel", async () => {
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry], {totalCount: 1}));

    const {result} = renderHook(() => useProfileStats(mockUser));

    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    await waitFor(() => expect(result.current.historyLoading).toBe(false));

    expect(result.current.stats).toEqual(stats);
    expect(result.current.historyItems).toEqual([historyEntry]);
    expect(result.current.historyTotalCount).toBe(1);
  });

  it("loads more history and keeps stats when history fails", async () => {
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meHistory)
      .mockResolvedValueOnce(paginated([historyEntry], {hasMore: true, totalCount: 2}))
      .mockResolvedValueOnce(paginated([secondHistoryEntry], {page: 2, hasMore: false, totalCount: 2}))
      .mockRejectedValueOnce(new Error("History unavailable"));

    const {result} = renderHook(() => useProfileStats(mockUser));

    await waitFor(() => expect(result.current.historyItems).toEqual([historyEntry]));
    expect(result.current.historyHasMore).toBe(true);

    await act(async () => {
      result.current.loadMoreHistory();
    });

    await waitFor(() => expect(result.current.historyItems).toHaveLength(2));

    await act(async () => {
      await result.current.reloadHistory();
    });

    await waitFor(() => expect(result.current.historyError).toBe("History unavailable"));
    expect(result.current.stats).toEqual(stats);
  });

  it("resets when signed out and isolates stats errors", async () => {
    vi.mocked(api.meStats).mockRejectedValue(new Error("Stats unavailable"));
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry]));

    const {result, rerender} = renderHook(({user}) => useProfileStats(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => {
      expect(result.current.statsError).toBe("Stats unavailable");
      expect(result.current.historyItems).toEqual([historyEntry]);
    });

    rerender({user: null});

    expect(result.current.stats).toBeNull();
    expect(result.current.historyItems).toEqual([]);
    expect(result.current.statsError).toBeNull();
    expect(result.current.historyError).toBeNull();
  });
});
