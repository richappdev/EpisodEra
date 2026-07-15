import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {SupportedLanguage, UserSettings, isSupportedLanguage} from "../types/settings";
import {toErrorMessage} from "./errorMessage";

const languageStorageKey = "episodera.language";
const autoMarkPreviousEpisodesWatchedStorageKey = "episodera.autoMarkPreviousEpisodesWatched";
const preferredProvidersStorageKey = "episodera.preferredProviderIds";
const watchRegionStorageKey = "episodera.watchRegion";

const initialLanguage = (): SupportedLanguage => {
  const stored = window.localStorage.getItem(languageStorageKey);
  return isSupportedLanguage(stored) ? stored : "en-US";
};

const initialAutoMarkPreviousEpisodesWatched = () =>
  window.localStorage.getItem(autoMarkPreviousEpisodesWatchedStorageKey) === "true";

const initialPreferredProviderIds = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(preferredProvidersStorageKey) ?? "[]");
    return Array.isArray(stored)
      ? stored.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
};

const initialWatchRegion = () => {
  const stored = window.localStorage.getItem(watchRegionStorageKey);
  return stored && /^[A-Za-z]{2}$/.test(stored) ? stored.toUpperCase() : "US";
};

const applySettingsState = (
  settings: UserSettings,
  setters: {
    setLanguage: (value: SupportedLanguage) => void;
    setAutoMarkPreviousEpisodesWatched: (value: boolean) => void;
    setPreferredProviderIds: (value: number[]) => void;
    setWatchRegion: (value: string) => void;
    setAchievementsEnabled: (value: boolean) => void;
    setShowAchievementsOnProfile: (value: boolean) => void;
    setShareActivityWithFriends: (value: boolean) => void;
    setAllowFriendRequests: (value: boolean) => void;
    setHideSpoilersUntilWatched: (value: boolean) => void;
  },
) => {
  setters.setLanguage(settings.language);
  setters.setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
  setters.setPreferredProviderIds(settings.preferredProviderIds ?? []);
  setters.setWatchRegion(settings.watchRegion ?? "US");
  setters.setAchievementsEnabled(settings.achievementsEnabled ?? true);
  setters.setShowAchievementsOnProfile(settings.showAchievementsOnProfile ?? true);
  setters.setShareActivityWithFriends(settings.shareActivityWithFriends ?? false);
  setters.setAllowFriendRequests(settings.allowFriendRequests ?? true);
  setters.setHideSpoilersUntilWatched(settings.hideSpoilersUntilWatched ?? true);
};

export const useSettings = (user: User | null) => {
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [autoMarkPreviousEpisodesWatched, setAutoMarkPreviousEpisodesWatched] = useState(
    initialAutoMarkPreviousEpisodesWatched,
  );
  const [preferredProviderIds, setPreferredProviderIds] = useState<number[]>(initialPreferredProviderIds);
  const [watchRegion, setWatchRegion] = useState(initialWatchRegion);
  const [achievementsEnabled, setAchievementsEnabled] = useState(true);
  const [showAchievementsOnProfile, setShowAchievementsOnProfile] = useState(true);
  const [shareActivityWithFriends, setShareActivityWithFriends] = useState(false);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [hideSpoilersUntilWatched, setHideSpoilersUntilWatched] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setters = {
    setLanguage,
    setAutoMarkPreviousEpisodesWatched,
    setPreferredProviderIds,
    setWatchRegion,
    setAchievementsEnabled,
    setShowAchievementsOnProfile,
    setShareActivityWithFriends,
    setAllowFriendRequests,
    setHideSpoilersUntilWatched,
  };

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(autoMarkPreviousEpisodesWatchedStorageKey, String(autoMarkPreviousEpisodesWatched));
  }, [autoMarkPreviousEpisodesWatched]);

  useEffect(() => {
    window.localStorage.setItem(preferredProvidersStorageKey, JSON.stringify(preferredProviderIds));
  }, [preferredProviderIds]);

  useEffect(() => {
    window.localStorage.setItem(watchRegionStorageKey, watchRegion);
  }, [watchRegion]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      applySettingsState(await api.meSettings(), setters);
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load settings."));
    } finally {
      setLoading(false);
    }
  }, [reset, user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void reload();
  }, [reload, reset, user]);

  const persistSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      if (!user) {
        return Promise.resolve();
      }

      setLoading(true);
      setError(null);

      return api
        .updateMeSettings(patch)
        .then((settings) => {
          applySettingsState(settings, setters);
        })
        .catch((reason: unknown) => {
          setError(toErrorMessage(reason, "Could not save settings."));
          throw reason;
        })
        .finally(() => setLoading(false));
    },
    [user],
  );

  const trackAndPersist = useCallback(
    (contentType: string, itemId: string, patch: Partial<UserSettings>, localApply: () => void) => {
      localApply();
      trackEvent("select_content", {content_type: contentType, item_id: itemId});
      setError(null);
      if (!user) {
        return;
      }
      void persistSettings(patch);
    },
    [persistSettings, user],
  );

  return {
    language,
    autoMarkPreviousEpisodesWatched,
    preferredProviderIds,
    watchRegion,
    achievementsEnabled,
    showAchievementsOnProfile,
    shareActivityWithFriends,
    allowFriendRequests,
    hideSpoilersUntilWatched,
    loading,
    error,
    reload,
    changeLanguage: (nextLanguage: SupportedLanguage) =>
      trackAndPersist("language", nextLanguage, {language: nextLanguage}, () => setLanguage(nextLanguage)),
    changeAutoMarkPreviousEpisodesWatched: (enabled: boolean) =>
      trackAndPersist("auto_mark_previous_episodes_watched", String(enabled), {autoMarkPreviousEpisodesWatched: enabled}, () =>
        setAutoMarkPreviousEpisodesWatched(enabled),
      ),
    changePreferredProviderIds: (providerIds: number[]) =>
      trackAndPersist("preferred_providers", providerIds.join(","), {preferredProviderIds: providerIds}, () =>
        setPreferredProviderIds(providerIds),
      ),
    changeWatchRegion: (region: string) => {
      const normalized = region.toUpperCase();
      trackAndPersist("watch_region", normalized, {watchRegion: normalized}, () => setWatchRegion(normalized));
    },
    changeAchievementsEnabled: (enabled: boolean) =>
      trackAndPersist("achievements_enabled", String(enabled), {achievementsEnabled: enabled}, () =>
        setAchievementsEnabled(enabled),
      ),
    changeShowAchievementsOnProfile: (enabled: boolean) =>
      trackAndPersist("show_achievements_on_profile", String(enabled), {showAchievementsOnProfile: enabled}, () =>
        setShowAchievementsOnProfile(enabled),
      ),
    changeShareActivityWithFriends: (enabled: boolean) =>
      trackAndPersist("share_activity_with_friends", String(enabled), {shareActivityWithFriends: enabled}, () =>
        setShareActivityWithFriends(enabled),
      ),
    changeAllowFriendRequests: (enabled: boolean) =>
      trackAndPersist("allow_friend_requests", String(enabled), {allowFriendRequests: enabled}, () =>
        setAllowFriendRequests(enabled),
      ),
    changeHideSpoilersUntilWatched: (enabled: boolean) =>
      trackAndPersist("hide_spoilers_until_watched", String(enabled), {hideSpoilersUntilWatched: enabled}, () =>
        setHideSpoilersUntilWatched(enabled),
      ),
  };
};
