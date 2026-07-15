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

const defaultSettings = {
  language: "en-US" as const,
  autoMarkPreviousEpisodesWatched: false,
  preferredProviderIds: [] as number[],
  watchRegion: "US",
  achievementsEnabled: true,
  showAchievementsOnProfile: true,
  shareActivityWithFriends: false,
  allowFriendRequests: true,
  hideSpoilersUntilWatched: true,
  updatedAt: null,
};

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
      ...defaultSettings,
      language: "zh-TW",
      autoMarkPreviousEpisodesWatched: true,
      preferredProviderIds: [8],
      watchRegion: "TW",
      shareActivityWithFriends: true,
    });

    const {result} = renderHook(() => useSettings(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.language).toBe("zh-TW");
    expect(result.current.autoMarkPreviousEpisodesWatched).toBe(true);
    expect(result.current.preferredProviderIds).toEqual([8]);
    expect(result.current.watchRegion).toBe("TW");
    expect(result.current.shareActivityWithFriends).toBe(true);
    expect(window.localStorage.getItem("episodera.language")).toBe("zh-TW");
  });

  it("updates local preferences when signed out", async () => {
    const {result} = renderHook(() => useSettings(null));

    act(() => {
      result.current.changeLanguage("zh-TW");
      result.current.changeAutoMarkPreviousEpisodesWatched(true);
      result.current.changePreferredProviderIds([337]);
      result.current.changeWatchRegion("gb");
      result.current.changeShareActivityWithFriends(true);
      result.current.changeAchievementsEnabled(false);
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
    expect(result.current.shareActivityWithFriends).toBe(true);
    expect(result.current.achievementsEnabled).toBe(false);
    expect(window.localStorage.getItem("episodera.autoMarkPreviousEpisodesWatched")).toBe("true");
  });

  it("persists language changes for signed-in users", async () => {
    vi.mocked(api.meSettings).mockResolvedValue(defaultSettings);
    vi.mocked(api.updateMeSettings).mockResolvedValue({
      ...defaultSettings,
      language: "zh-TW",
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
