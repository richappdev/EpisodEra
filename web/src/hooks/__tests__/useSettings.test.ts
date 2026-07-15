import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {trackEvent} from "../../firebase";
import {useSettings} from "../useSettings";
import {mockUser} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    meSettings: vi.fn(),
    updateMeSettings: vi.fn(),
  },
}));

vi.mock("../../firebase", () => ({
  trackEvent: vi.fn(),
}));

describe("useSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("hydrates settings from the API for signed-in users", async () => {
    vi.mocked(api.meSettings).mockResolvedValue({
      language: "zh-TW",
      autoMarkPreviousEpisodesWatched: true,
      preferredProviderIds: [8],
      watchRegion: "TW",
      updatedAt: null,
    });

    const {result} = renderHook(() => useSettings(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.language).toBe("zh-TW");
    expect(result.current.autoMarkPreviousEpisodesWatched).toBe(true);
    expect(result.current.preferredProviderIds).toEqual([8]);
    expect(result.current.watchRegion).toBe("TW");
    expect(window.localStorage.getItem("episodera.language")).toBe("zh-TW");
  });

  it("updates local preferences when signed out", async () => {
    const {result} = renderHook(() => useSettings(null));

    act(() => {
      result.current.changeLanguage("zh-TW");
      result.current.changeAutoMarkPreviousEpisodesWatched(true);
      result.current.changePreferredProviderIds([337]);
      result.current.changeWatchRegion("gb");
    });

    expect(api.updateMeSettings).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("select_content", {
      content_type: "language",
      item_id: "zh-TW",
    });
    expect(result.current.language).toBe("zh-TW");
    expect(result.current.autoMarkPreviousEpisodesWatched).toBe(true);
    expect(result.current.preferredProviderIds).toEqual([337]);
    expect(result.current.watchRegion).toBe("GB");
    expect(window.localStorage.getItem("episodera.autoMarkPreviousEpisodesWatched")).toBe("true");
  });

  it("persists language changes for signed-in users", async () => {
    vi.mocked(api.meSettings).mockResolvedValue({
      language: "en-US",
      autoMarkPreviousEpisodesWatched: false,
      preferredProviderIds: [],
      watchRegion: "US",
      updatedAt: null,
    });
    vi.mocked(api.updateMeSettings).mockResolvedValue({
      language: "zh-TW",
      autoMarkPreviousEpisodesWatched: false,
      preferredProviderIds: [],
      watchRegion: "US",
      updatedAt: null,
    });

    const {result} = renderHook(() => useSettings(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.changeLanguage("zh-TW");
    });

    await waitFor(() => expect(api.updateMeSettings).toHaveBeenCalledWith({language: "zh-TW"}));
    expect(result.current.language).toBe("zh-TW");
  });

  it("surfaces load errors", async () => {
    vi.mocked(api.meSettings).mockRejectedValue(new Error("Load failed"));

    const {result} = renderHook(() => useSettings(mockUser));

    await waitFor(() => expect(result.current.error).toBe("Load failed"));
    expect(result.current.loading).toBe(false);
  });
});
