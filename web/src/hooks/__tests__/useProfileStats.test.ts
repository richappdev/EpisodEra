import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {now, stats, yearRecap} from "../../test/fixtures";
import {HistoryEntry} from "../../types/history";
import {useProfileStats} from "../useProfileStats";
import {mockUser, paginated} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    meStats: vi.fn(),
    meHistory: vi.fn(),
    meRecap: vi.fn(),
    updateHistoryEntry: vi.fn(),
    deleteHistoryEntry: vi.fn(),
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

  it("loads stats, history, and year recap in parallel", async () => {
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry], {totalCount: 1}));
    vi.mocked(api.meRecap).mockResolvedValue(yearRecap);

    const {result} = renderHook(() => useProfileStats(mockUser));

    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    await waitFor(() => expect(result.current.recapLoading).toBe(false));

    expect(result.current.stats).toEqual(stats);
    expect(result.current.historyItems).toEqual([historyEntry]);
    expect(result.current.historyTotalCount).toBe(1);
    expect(result.current.recap).toEqual(yearRecap);
    expect(api.meRecap).toHaveBeenCalledWith(new Date().getUTCFullYear());
  });

  it("loads more history and keeps stats when history fails", async () => {
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meRecap).mockResolvedValue(yearRecap);
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
    expect(result.current.recap).toEqual(yearRecap);
  });

  it("resets when signed out and isolates stats errors", async () => {
    vi.mocked(api.meStats).mockRejectedValue(new Error("Stats unavailable"));
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry]));
    vi.mocked(api.meRecap).mockResolvedValue(yearRecap);

    const {result, rerender} = renderHook(({user}) => useProfileStats(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => {
      expect(result.current.statsError).toBe("Stats unavailable");
      expect(result.current.historyItems).toEqual([historyEntry]);
    });

    rerender({user: null});

    expect(result.current.stats).toBeNull();
    expect(result.current.recap).toBeNull();
    expect(result.current.historyItems).toEqual([]);
    expect(result.current.statsError).toBeNull();
    expect(result.current.historyError).toBeNull();
    expect(result.current.recapError).toBeNull();
  });

  it("loads a different recap year on demand", async () => {
    const priorYear = {...yearRecap, year: 2025};
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry]));
    vi.mocked(api.meRecap).mockImplementation(async (year?: number) =>
      year === 2025 ? priorYear : yearRecap,
    );

    const {result} = renderHook(() => useProfileStats(mockUser));
    await waitFor(() => expect(result.current.recap).toEqual(yearRecap));

    await act(async () => {
      await result.current.loadRecap(2025);
    });

    await waitFor(() => expect(result.current.recap).toEqual(priorYear));
    expect(result.current.recapYear).toBe(2025);
    expect(api.meRecap).toHaveBeenCalledWith(2025);
  });

  it("updates watchedAt and deletes history entries", async () => {
    const updated = {...historyEntry, watchedAt: "2026-07-01T00:00:00.000Z"};
    vi.mocked(api.meStats).mockResolvedValue(stats);
    vi.mocked(api.meHistory).mockResolvedValue(paginated([historyEntry], {totalCount: 1}));
    vi.mocked(api.meRecap).mockResolvedValue(yearRecap);
    vi.mocked(api.updateHistoryEntry).mockResolvedValue(updated);
    vi.mocked(api.deleteHistoryEntry).mockResolvedValue(null);

    const {result} = renderHook(() => useProfileStats(mockUser));
    await waitFor(() => expect(result.current.historyItems).toHaveLength(1));

    await act(async () => {
      await result.current.updateHistoryWatchedAt(historyEntry.historyId, updated.watchedAt!);
    });
    expect(result.current.historyItems[0]).toEqual(updated);

    await act(async () => {
      await result.current.deleteHistoryEntry(historyEntry.historyId);
    });
    expect(result.current.historyItems).toEqual([]);
    expect(api.deleteHistoryEntry).toHaveBeenCalledWith(historyEntry.historyId);
    expect(api.meRecap).toHaveBeenCalled();
  });
});
