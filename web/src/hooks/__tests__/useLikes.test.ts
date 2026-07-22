import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {trackEvent} from "../../firebase";
import {likedItem} from "../../test/fixtures";
import {useLikes} from "../useLikes";
import {mockUser, paginated} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    listLikedItems: vi.fn(),
    addLikedItem: vi.fn(),
    removeLikedItem: vi.fn(),
  },
}));

vi.mock("../../firebase", () => ({
  trackEvent: vi.fn(),
}));

const secondItem = {
  ...likedItem,
  itemId: "tv_2002",
  tmdbId: 2002,
  title: "Second Show",
};

describe("useLikes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads all pages when a user is present", async () => {
    vi.mocked(api.listLikedItems)
      .mockResolvedValueOnce(
        paginated([likedItem], {hasMore: true, pageSize: 100, nextPageToken: "token-2"}),
      )
      .mockResolvedValueOnce(paginated([secondItem], {hasMore: false, pageSize: 100}));

    const {result} = renderHook(() => useLikes(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.listLikedItems).toHaveBeenNthCalledWith(1, {pageSize: 100, pageToken: undefined});
    expect(api.listLikedItems).toHaveBeenNthCalledWith(2, {pageSize: 100, pageToken: "token-2"});
    expect(result.current.items).toEqual([likedItem, secondItem]);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("resets when the user signs out", async () => {
    vi.mocked(api.listLikedItems).mockResolvedValue(paginated([likedItem]));

    const {result, rerender} = renderHook(({user}) => useLikes(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({user: null});

    expect(result.current.items).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("adds and removes liked items", async () => {
    const onLibraryChange = vi.fn();
    const addedItem = {...likedItem, itemId: "tv_3003", tmdbId: 3003, title: "Added Show"};

    vi.mocked(api.listLikedItems).mockResolvedValue(paginated([]));
    vi.mocked(api.addLikedItem).mockResolvedValue(addedItem);
    vi.mocked(api.removeLikedItem).mockResolvedValue(null);

    const {result} = renderHook(() => useLikes(mockUser, onLibraryChange));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addLikedItem({
        tmdbId: addedItem.tmdbId,
        mediaType: "tv",
        title: addedItem.title,
      });
    });

    expect(trackEvent).toHaveBeenCalledWith("like_content", {
      content_type: "tv",
      item_id: "3003",
    });
    expect(result.current.items[0]).toEqual(addedItem);
    expect(onLibraryChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.removeLikedItem(addedItem);
    });

    expect(result.current.items).toEqual([]);
    expect(onLibraryChange).toHaveBeenCalledTimes(2);
  });

  it("records mutation errors without dropping existing items", async () => {
    vi.mocked(api.listLikedItems).mockResolvedValue(paginated([likedItem]));
    vi.mocked(api.addLikedItem).mockRejectedValue(new Error("Like failed"));

    const {result} = renderHook(() => useLikes(mockUser));

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await expect(
        result.current.addLikedItem({
          tmdbId: 9999,
          mediaType: "tv",
          title: "Broken Show",
        }),
      ).rejects.toThrow("Like failed");
    });

    expect(result.current.error).toBe("Like failed");
    expect(result.current.items).toEqual([likedItem]);
  });
});
