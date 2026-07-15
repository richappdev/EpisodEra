import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {progressSummary} from "../../test/fixtures";
import {useProgress} from "../useProgress";
import {mockUser, paginated} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    listProgress: vi.fn(),
    updateEpisodes: vi.fn(),
  },
}));

const secondSummary = {
  ...progressSummary,
  showId: "2002",
  tmdbId: 2002,
  title: "Second Show",
};

describe("useProgress", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads all progress pages for a signed-in user", async () => {
    vi.mocked(api.listProgress)
      .mockResolvedValueOnce(paginated([progressSummary], {hasMore: true, pageSize: 100}))
      .mockResolvedValueOnce(paginated([secondSummary], {page: 2, hasMore: false, pageSize: 100}));

    const {result} = renderHook(() => useProgress(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.listProgress).toHaveBeenNthCalledWith(1, {page: 1, pageSize: 100});
    expect(api.listProgress).toHaveBeenNthCalledWith(2, {page: 2, pageSize: 100});
    expect(result.current.items).toEqual([progressSummary, secondSummary]);
  });

  it("resets on sign-out and surfaces load errors", async () => {
    vi.mocked(api.listProgress).mockRejectedValue(new Error("Progress unavailable"));

    const {result, rerender} = renderHook(({user}) => useProgress(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => expect(result.current.error).toBe("Progress unavailable"));

    rerender({user: null});

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("upserts, removes, and marks the next episode watched", async () => {
    const onLibraryChange = vi.fn();
    const updatedSummary = {
      ...progressSummary,
      watchedEpisodeCount: 2,
      progressPercent: 66.67,
      currentEpisode: 2,
      nextEpisode: {episodeKey: "s01e03", seasonNumber: 1, episodeNumber: 3, episodeTitle: "Next"},
    };

    vi.mocked(api.listProgress).mockResolvedValue(paginated([progressSummary]));
    vi.mocked(api.updateEpisodes).mockResolvedValue(updatedSummary);

    const {result} = renderHook(() => useProgress(mockUser, onLibraryChange));

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => {
      result.current.upsertProgressItem(null);
      result.current.upsertProgressItem(updatedSummary);
    });

    expect(result.current.items[0]).toEqual(updatedSummary);

    await act(async () => {
      await result.current.markNextEpisodeWatched(progressSummary.tmdbId, progressSummary.nextEpisode!);
    });

    expect(api.updateEpisodes).toHaveBeenCalledWith(progressSummary.tmdbId, {
      watched: true,
      episodes: [{seasonNumber: 1, episodeNumber: 2}],
    });
    expect(onLibraryChange).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.removeProgressItem(progressSummary.tmdbId);
    });

    expect(result.current.items).toEqual([]);
  });

  it("rolls back optimistic progress when mark-watched fails", async () => {
    vi.mocked(api.listProgress).mockResolvedValue(paginated([progressSummary]));
    vi.mocked(api.updateEpisodes).mockRejectedValue(new Error("Update failed"));

    const {result} = renderHook(() => useProgress(mockUser));

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await expect(
        result.current.markNextEpisodeWatched(progressSummary.tmdbId, progressSummary.nextEpisode!),
      ).rejects.toThrow("Update failed");
    });

    expect(result.current.error).toBe("Update failed");
    expect(result.current.items[0]).toEqual(progressSummary);
    expect(result.current.pendingShowIds.has(progressSummary.tmdbId)).toBe(false);
  });
});
