import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {trackEvent} from "../../firebase";
import {now, watchlistItem} from "../../test/fixtures";
import {useWatchlist} from "../useWatchlist";
import {mockUser, paginated} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    listWatchlist: vi.fn(),
    addWatchlistItem: vi.fn(),
    updateWatchlistStatus: vi.fn(),
    removeWatchlistItem: vi.fn(),
  },
}));

vi.mock("../../firebase", () => ({
  trackEvent: vi.fn(),
}));

const secondItem = {
  ...watchlistItem,
  itemId: "tv_2002",
  tmdbId: 2002,
  title: "Second Show",
  status: "planned" as const,
};

describe("useWatchlist", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads all pages when a user is present", async () => {
    vi.mocked(api.listWatchlist)
      .mockResolvedValueOnce(paginated([watchlistItem], {hasMore: true, pageSize: 100, totalCount: 2}))
      .mockResolvedValueOnce(paginated([secondItem], {page: 2, hasMore: false, pageSize: 100, totalCount: 2}));

    const {result} = renderHook(() => useWatchlist(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.listWatchlist).toHaveBeenNthCalledWith(1, {page: 1, pageSize: 100});
    expect(api.listWatchlist).toHaveBeenNthCalledWith(2, {page: 2, pageSize: 100});
    expect(result.current.items).toEqual([watchlistItem, secondItem]);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("resets when the user signs out", async () => {
    vi.mocked(api.listWatchlist).mockResolvedValue(paginated([watchlistItem]));

    const {result, rerender} = renderHook(({user}) => useWatchlist(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({user: null});

    expect(result.current.items).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("surfaces list errors without dropping prior successful state on reload", async () => {
    vi.mocked(api.listWatchlist)
      .mockResolvedValueOnce(paginated([watchlistItem]))
      .mockRejectedValueOnce(new Error("Watchlist unavailable"));

    const {result} = renderHook(() => useWatchlist(mockUser));

    await waitFor(() => expect(result.current.items).toEqual([watchlistItem]));

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.error).toBe("Watchlist unavailable"));
  });

  it("adds, updates, and removes watchlist items", async () => {
    const onLibraryChange = vi.fn();
    const addedItem = {...watchlistItem, itemId: "tv_3003", tmdbId: 3003, title: "Added Show"};
    const updatedItem = {...addedItem, status: "completed" as const, updatedAt: now};

    vi.mocked(api.listWatchlist).mockResolvedValue(paginated([]));
    vi.mocked(api.addWatchlistItem).mockResolvedValue(addedItem);
    vi.mocked(api.updateWatchlistStatus).mockResolvedValue(updatedItem);
    vi.mocked(api.removeWatchlistItem).mockResolvedValue(null);

    const {result} = renderHook(() => useWatchlist(mockUser, onLibraryChange));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addToWatchlist({
        tmdbId: addedItem.tmdbId,
        mediaType: "tv",
        title: addedItem.title,
      });
    });

    expect(trackEvent).toHaveBeenCalledWith("add_to_wishlist", {
      content_type: "tv",
      item_id: "3003",
    });
    expect(result.current.items[0]).toEqual(addedItem);
    expect(onLibraryChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      const unchanged = await result.current.updateWatchlistStatus(addedItem, addedItem.status);
      expect(unchanged).toBe(addedItem);
    });
    expect(api.updateWatchlistStatus).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.updateWatchlistStatus(addedItem, "completed");
    });

    expect(result.current.items[0].status).toBe("completed");

    await act(async () => {
      await result.current.removeWatchlistItem(updatedItem);
    });

    expect(result.current.items).toEqual([]);
    expect(onLibraryChange).toHaveBeenCalledTimes(3);
  });

  it("records mutation errors without dropping existing items", async () => {
    vi.mocked(api.listWatchlist).mockResolvedValue(paginated([watchlistItem]));
    vi.mocked(api.addWatchlistItem).mockRejectedValue(new Error("Add failed"));

    const {result} = renderHook(() => useWatchlist(mockUser));

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await expect(
        result.current.addToWatchlist({
          tmdbId: 9999,
          mediaType: "tv",
          title: "Broken Show",
        }),
      ).rejects.toThrow("Add failed");
    });

    expect(result.current.error).toBe("Add failed");
    expect(result.current.items).toEqual([watchlistItem]);
  });
});
