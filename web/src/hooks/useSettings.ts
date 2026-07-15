import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {SupportedLanguage, isSupportedLanguage} from "../types/settings";
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

export const useSettings = (user: User | null) => {
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [autoMarkPreviousEpisodesWatched, setAutoMarkPreviousEpisodesWatched] = useState(
    initialAutoMarkPreviousEpisodesWatched,
  );
  const [preferredProviderIds, setPreferredProviderIds] = useState<number[]>(initialPreferredProviderIds);
  const [watchRegion, setWatchRegion] = useState(initialWatchRegion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const settings = await api.meSettings();
      setLanguage(settings.language);
      setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
      setPreferredProviderIds(settings.preferredProviderIds ?? []);
      setWatchRegion(settings.watchRegion ?? "US");
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
    (
      patch: Partial<{
        language: SupportedLanguage;
        autoMarkPreviousEpisodesWatched: boolean;
        preferredProviderIds: number[];
        watchRegion: string;
      }>,
    ) => {
      if (!user) {
        return Promise.resolve();
      }

      setLoading(true);
      setError(null);

      return api
        .updateMeSettings(patch)
        .then((settings) => {
          setLanguage(settings.language);
          setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
          setPreferredProviderIds(settings.preferredProviderIds ?? []);
          setWatchRegion(settings.watchRegion ?? "US");
        })
        .catch((reason: unknown) => {
          setError(toErrorMessage(reason, "Could not save settings."));
          throw reason;
        })
        .finally(() => setLoading(false));
    },
    [user],
  );

  const changeLanguage = useCallback(
    (nextLanguage: SupportedLanguage) => {
      setLanguage(nextLanguage);
      trackEvent("select_content", {
        content_type: "language",
        item_id: nextLanguage,
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({language: nextLanguage});
    },
    [persistSettings, user],
  );

  const changeAutoMarkPreviousEpisodesWatched = useCallback(
    (enabled: boolean) => {
      setAutoMarkPreviousEpisodesWatched(enabled);
      trackEvent("select_content", {
        content_type: "auto_mark_previous_episodes_watched",
        item_id: String(enabled),
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({autoMarkPreviousEpisodesWatched: enabled});
    },
    [persistSettings, user],
  );

  const changePreferredProviderIds = useCallback(
    (providerIds: number[]) => {
      setPreferredProviderIds(providerIds);
      trackEvent("select_content", {
        content_type: "preferred_providers",
        item_id: providerIds.join(","),
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({preferredProviderIds: providerIds});
    },
    [persistSettings, user],
  );

  const changeWatchRegion = useCallback(
    (region: string) => {
      const normalized = region.toUpperCase();
      setWatchRegion(normalized);
      trackEvent("select_content", {
        content_type: "watch_region",
        item_id: normalized,
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({watchRegion: normalized});
    },
    [persistSettings, user],
  );

  return {
    language,
    autoMarkPreviousEpisodesWatched,
    preferredProviderIds,
    watchRegion,
    loading,
    error,
    reload,
    changeLanguage,
    changeAutoMarkPreviousEpisodesWatched,
    changePreferredProviderIds,
    changeWatchRegion,
  };
};
